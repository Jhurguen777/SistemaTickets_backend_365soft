import prisma from '../../shared/config/database';
import { EstadoAsiento } from '@prisma/client';
import {
  tryLockSeat,
  unlockSeat,
  getLockedSeatsForEvent,
  acquireBatchSeatLocks,
  releaseBatchSeatLocks,
  releaseBatchSeatLocksForce,
  extendLockTTL
} from './asientos.redis';

// Constantes de tiempo para locks
const LOCK_TTL_EXTENDED = 600; // 10 minutos (para proceso de pago)

export interface AsientoConEstadoReal {
  id: string;
  numero: number;
  fila: string;
  precio: number | null;
  estado: EstadoAsiento | 'RESERVANDO';
  eventoId: string;
  lockedByMe?: boolean;
  ttlSegundos?: number;
}

// ✅ Helper: obtener locks de Redis sin crashear si Redis no está
const getLocksSeguro = async (eventoId: string) => {
  try {
    return await getLockedSeatsForEvent(eventoId);
  } catch (err) {
    console.warn('⚠️ Redis no disponible, omitiendo locks:', err);
    return [];
  }
};

export const getAsientosPorEvento = async (
  eventoId: string,
  userId?: string
): Promise<AsientoConEstadoReal[]> => {
  // ✅ BD y Redis en paralelo — Redis falla silenciosamente
  const [asientos, locks] = await Promise.all([
    prisma.asiento.findMany({
      where: { eventoId },
      orderBy: [{ fila: 'asc' }, { numero: 'asc' }],
    }),
    getLocksSeguro(eventoId),
  ]);

  const lockMap = new Map(locks.map((l: any) => [l.asientoId, l]));

  return asientos.map((a) => {
    const lock = lockMap.get(a.id);
    const estado = lock && a.estado === EstadoAsiento.DISPONIBLE ? 'RESERVANDO' : a.estado;

    const result: AsientoConEstadoReal = {
      id:       a.id,
      numero:   a.numero,
      fila:     a.fila,
      precio:   a.precio,
      estado:   estado as EstadoAsiento | 'RESERVANDO',
      eventoId: a.eventoId,
    };

    if (lock) {
      result.lockedByMe = userId ? lock.userId === userId : false;
      result.ttlSegundos = lock.ttlSeconds;
    }

    return result;
  });
};

export const getAsientoById = async (
  asientoId: string,
  userId?: string
): Promise<AsientoConEstadoReal | null> => {
  const asiento = await prisma.asiento.findUnique({ where: { id: asientoId } });
  if (!asiento) return null;

  const locks = await getLocksSeguro(asiento.eventoId);
  const lock  = locks.find((l) => l.asientoId === asientoId);
  const estado = lock && asiento.estado === EstadoAsiento.DISPONIBLE ? 'RESERVANDO' : asiento.estado;

  return {
    id:       asiento.id,
    numero:   asiento.numero,
    fila:     asiento.fila,
    precio:   asiento.precio,
    estado:   estado as EstadoAsiento | 'RESERVANDO',
    eventoId: asiento.eventoId,
    ...(lock && {
      lockedByMe:  userId ? lock.userId === userId : false,
      ttlSegundos: lock.ttlSeconds,
    }),
  };
};

export const reservarAsiento = async ({
  asientoId, eventoId, userId,
}: {
  asientoId: string; eventoId: string; userId: string;
}): Promise<AsientoConEstadoReal> => {
  const asiento = await prisma.asiento.findUnique({ where: { id: asientoId } });

  if (!asiento)                                    throw new Error('ASIENTO_NO_ENCONTRADO');
  if (asiento.eventoId !== eventoId)               throw new Error('ASIENTO_EVENTO_INVALIDO');
  if (asiento.estado !== EstadoAsiento.DISPONIBLE) throw new Error('ASIENTO_NO_DISPONIBLE');

  // ✅ Si Redis falla, igual intentamos reservar (sin lock distribuido)
  let locked = false;
  try {
    locked = await tryLockSeat(eventoId, asientoId, userId);
    if (!locked) throw new Error('ASIENTO_EN_PROCESO');
  } catch (err) {
    if (err instanceof Error && err.message === 'ASIENTO_EN_PROCESO') throw err;
    console.warn('⚠️ Redis no disponible para lock, procediendo sin él:', err);
  }

  try {
    const actualizado = await prisma.asiento.update({
      where: { id: asientoId },
      data:  { estado: EstadoAsiento.RESERVANDO },
    });

    return {
      id:          actualizado.id,
      numero:      actualizado.numero,
      fila:        actualizado.fila,
      precio:      actualizado.precio,
      estado:      actualizado.estado,
      eventoId:    actualizado.eventoId,
      lockedByMe:  true,
      ttlSegundos: 300,
    };
  } catch {
    try { await unlockSeat(eventoId, asientoId, userId); } catch {}
    throw new Error('ERROR_ACTUALIZANDO_ASIENTO');
  }
};

export const liberarAsiento = async ({
  asientoId, eventoId, userId,
}: {
  asientoId: string; eventoId: string; userId: string;
}): Promise<AsientoConEstadoReal> => {
  const asiento = await prisma.asiento.findUnique({ where: { id: asientoId } });

  if (!asiento)                                    throw new Error('ASIENTO_NO_ENCONTRADO');
  if (asiento.estado !== EstadoAsiento.RESERVANDO) throw new Error('ASIENTO_NO_RESERVADO');

  // ✅ Si Redis falla, igual liberamos en BD
  try {
    const released = await unlockSeat(eventoId, asientoId, userId);
    if (!released) throw new Error('NO_TIENES_PERMISO_LIBERAR');
  } catch (err) {
    if (err instanceof Error && err.message === 'NO_TIENES_PERMISO_LIBERAR') throw err;
    console.warn('⚠️ Redis no disponible para unlock, liberando solo en BD:', err);
  }

  const actualizado = await prisma.asiento.update({
    where: { id: asientoId },
    data:  { estado: EstadoAsiento.DISPONIBLE },
  });

  return {
    id:       actualizado.id,
    numero:   actualizado.numero,
    fila:     actualizado.fila,
    precio:   actualizado.precio,
    estado:   actualizado.estado,
    eventoId: actualizado.eventoId,
  };
};

export const sincronizarAsientosExpirados = async (eventoId: string): Promise<number> => {
  let idsConLock = new Set<string>();

  try {
    const locks = await getLockedSeatsForEvent(eventoId);
    idsConLock = new Set(locks.map((l) => l.asientoId));
  } catch {
    console.warn('⚠️ Redis no disponible en sincronizarAsientosExpirados');
  }

  const huerfanos = await prisma.asiento.findMany({
    where: {
      eventoId,
      estado: EstadoAsiento.RESERVANDO,
      id: { notIn: Array.from(idsConLock) },
    },
  });

  if (!huerfanos.length) return 0;

  await prisma.asiento.updateMany({
    where: { id: { in: huerfanos.map((a) => a.id) } },
    data:  { estado: EstadoAsiento.DISPONIBLE },
  });

  return huerfanos.length;
};

/**
 * Reservar múltiples asientos (carrito) con lock colectivo atómico
 * Bloquea todos los asientos o libera todos si alguno falla
 */
export const reservarVarios = async ({
  asientosIds,
  eventoId,
  userId,
}: {
  asientosIds: string[];
  eventoId: string;
  userId: string;
}): Promise<{
  success: boolean;
  asientos: AsientoConEstadoReal[];
  message: string;
}> => {
  // Validar que el evento exista
  const evento = await prisma.evento.findUnique({
    where: { id: eventoId }
  });

  if (!evento) {
    throw new Error('EVENTO_NO_ENCONTRADO');
  }

  // Validar que los asientos existan y pertenezcan al evento
  const asientos = await prisma.asiento.findMany({
    where: {
      id: { in: asientosIds },
      eventoId
    }
  });

  if (asientos.length !== asientosIds.length) {
    throw new Error('ALGUNOS_ASIENTOS_NO_EXISTEN');
  }

  // Verificar que todos estén disponibles
  const noDisponibles = asientos.filter(
    a => a.estado !== EstadoAsiento.DISPONIBLE
  );

  if (noDisponibles.length > 0) {
    const ids = noDisponibles.map(a => `${a.fila}${a.numero}`).join(', ');
    throw new Error(`ASIENTOS_NO_DISPONIBLE:${ids}`);
  }

  // Intentar bloquear todos los asientos en Redis
  const lockResult = await acquireBatchSeatLocks(eventoId, asientosIds, userId);

  if (!lockResult.success) {
    const idsFallidos = lockResult.failedIds.map((id: string) => {
      const asiento = asientos.find(a => a.id === id);
      return asiento ? `${asiento.fila}${asiento.numero}` : id;
    }).join(', ');

    throw new Error(`ASIENTOS_OCUPADOS:${idsFallidos}`);
  }

  try {
    // Actualizar todos los asientos a RESERVANDO (transaccional)
    await prisma.$transaction(async (tx) => {
      await tx.asiento.updateMany({
        where: { id: { in: asientosIds } },
        data: { estado: EstadoAsiento.RESERVANDO, reservadoEn: new Date() }
      });
    });

    console.log(`✅ ${asientosIds.length} asientos reservados para usuario ${userId}`);

    return {
      success: true,
      asientos: asientos.map(a => ({
        id: a.id,
        numero: a.numero,
        fila: a.fila,
        precio: a.precio,
        estado: EstadoAsiento.RESERVANDO,
        eventoId: a.eventoId,
        lockedByMe: true,
        ttlSegundos: LOCK_TTL_EXTENDED / 60
      })),
      message: `Asientos reservados por 3 minutos`
    };
  } catch (error) {
    // Rollback: liberar todos los locks
    await releaseBatchSeatLocksForce(eventoId, asientosIds);
    console.error('❌ Error en transacción de reservarVarios:', error);
    throw error;
  }
};

/**
 * Liberar múltiples asientos (cancelar reserva del carrito)
 */
export const liberarVarios = async ({
  asientosIds,
  eventoId,
  userId,
}: {
  asientosIds: string[];
  eventoId: string;
  userId: string;
}): Promise<void> => {
  // Verificar que los asientos existan
  const asientos = await prisma.asiento.findMany({
    where: {
      id: { in: asientosIds },
      eventoId
    }
  });

  if (asientos.length === 0) {
    throw new Error('ASIENTOS_NO_ENCONTRADOS');
  }

  // Verificar que el usuario tenga los locks
  const locksFallidos: string[] = [];
  for (const asientoId of asientosIds) {
    const asiento = asientos.find(a => a.id === asientoId);
    if (!asiento || asiento.estado !== EstadoAsiento.RESERVANDO) {
      locksFallidos.push(asientoId);
      continue;
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Actualizar asientos a DISPONIBLE
      await tx.asiento.updateMany({
        where: { id: { in: asientosIds.filter(id => !locksFallidos.includes(id)) } },
        data: { estado: EstadoAsiento.DISPONIBLE, reservadoEn: null }
      });
    });

    // Liberar locks de Redis
    await releaseBatchSeatLocks(eventoId, asientosIds, userId);

    console.log(`✅ ${asientosIds.length - locksFallidos.length} asientos liberados para usuario ${userId}`);
  } catch (error) {
    console.error('❌ Error en liberarVarios:', error);
    throw error;
  }
};

/**
 * Extender locks de asientos para proceso de pago
 */
export const extenderLocksParaPago = async ({
  asientosIds,
  eventoId,
  userId,
}: {
  asientosIds: string[];
  eventoId: string;
  userId: string;
}): Promise<boolean> => {
  let extendidos = 0;
  let fallidos = 0;

  for (const asientoId of asientosIds) {
    try {
      const extendido = await extendLockTTL(eventoId, asientoId, userId);
      if (extendido) {
        extendidos++;
      } else {
        fallidos++;
      }
    } catch (err) {
      console.warn(`⚠️  Error extendiendo lock de asiento ${asientoId}:`, err);
      fallidos++;
    }
  }

  if (fallidos > 0) {
    console.warn(`⚠️  No se pudieron extender ${fallidos} de ${asientosIds.length} locks`);
    return false;
  }

  console.log(`✅ ${extendidos} locks extendidos a ${LOCK_TTL_EXTENDED} segundos`);
  return true;
};

/**
 * Limpia asientos de un evento - resetea estado a DISPONIBLE y libera locks de Redis
 * Solo debe ser usado por administradores para mantenimiento o pruebas
 */
export const limpiarAsientosEvento = async (eventoId: string) => {
  try {
    // 1. Resetear todos los asientos del evento a DISPONIBLE
    const actualizados = await prisma.asiento.updateMany({
      where: {
        eventoId,
        estado: { not: EstadoAsiento.BLOQUEADO } // No resetear asientos bloqueados por admin
      },
      data: {
        estado: EstadoAsiento.DISPONIBLE,
        reservadoEn: null
      }
    });

    console.log(`🧹 ${actualizados.count} asientos reseteados a DISPONIBLE`);

    // 2. Liberar todos los locks de Redis para este evento
    try {
      const locksActivos = await getLockedSeatsForEvent(eventoId);

      if (locksActivos.length > 0) {
        const asientosIds = locksActivos.map(l => l.asientoId);
        await releaseBatchSeatLocksForce(eventoId, asientosIds);
        console.log(`🧹 ${asientosIds.length} locks liberados de Redis`);
      }
    } catch (redisErr) {
      console.warn('⚠️ Error liberando locks de Redis:', redisErr);
    }

    return {
      asientosReseteados: actualizados.count,
      eventoId
    };
  } catch (error) {
    console.error('❌ Error limpiando asientos:', error);
    throw error;
  }
};