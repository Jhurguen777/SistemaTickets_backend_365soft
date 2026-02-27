// src/modules/asientos/asientos.service.ts
import prisma from '../../shared/config/database';
import { EstadoAsiento } from '@prisma/client';
import { tryLockSeat, unlockSeat, getLockedSeatsForEvent } from './asientos.redis';

export interface AsientoConEstadoReal {
  id: string;
  numero: number;
  fila: string;
  precio: number | null;     // ✅ precio individual (null = heredar del evento)
  estado: EstadoAsiento | 'EN_PROCESO';
  eventoId: string;
  lockedByMe?: boolean;
  ttlSegundos?: number;
}

export const getAsientosPorEvento = async (
  eventoId: string,
  userId?: string
): Promise<AsientoConEstadoReal[]> => {
  let locks: [any[], any[]];

  try {
    // Intentar obtener locks de Redis, pero fallar graceful si no está disponible
    locks = await Promise.all([
      prisma.asiento.findMany({
        where: { eventoId },
        orderBy: [{ fila: 'asc' }, { numero: 'asc' }],
      }),
      getLockedSeatsForEvent(eventoId).catch(() => []), // ✅ Si Redis falla, retorna array vacío
    ]);
  } catch (error) {
    // Si Redis falla completamente, usar solo datos de BD
    console.warn('⚠️  Redis no disponible, cargando asientos sin locks en tiempo real');
    const asientos = await prisma.asiento.findMany({
      where: { eventoId },
      orderBy: [{ fila: 'asc' }, { numero: 'asc' }],
    });
    locks = [asientos, []];
  }

  const [asientos, lockedSeats] = locks;
  const lockMap = new Map(lockedSeats.map((l: any) => [l.asientoId, l]));

  return asientos.map((a: any) => {
    const lock = lockMap.get(a.id);
    const estado = lock && a.estado === EstadoAsiento.DISPONIBLE ? 'EN_PROCESO' : a.estado;

    const result: AsientoConEstadoReal = {
      id: a.id,
      numero: a.numero,
      fila: a.fila,
      precio: a.precio,
      estado: estado as EstadoAsiento | 'EN_PROCESO',
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

  const locks = await getLockedSeatsForEvent(asiento.eventoId);
  const lock  = locks.find((l) => l.asientoId === asientoId);
  const estado = lock && asiento.estado === EstadoAsiento.DISPONIBLE ? 'EN_PROCESO' : asiento.estado;

  return {
    id:       asiento.id,
    numero:   asiento.numero,
    fila:     asiento.fila,
    precio:   asiento.precio,   // ✅
    estado:   estado as EstadoAsiento | 'EN_PROCESO',
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

  const locked = await tryLockSeat(eventoId, asientoId, userId);
  if (!locked) throw new Error('ASIENTO_EN_PROCESO');

  try {
    const actualizado = await prisma.asiento.update({
      where: { id: asientoId },
      data:  { estado: EstadoAsiento.RESERVANDO },
    });

    return {
      id:          actualizado.id,
      numero:      actualizado.numero,
      fila:        actualizado.fila,
      precio:      actualizado.precio,  // ✅
      estado:      actualizado.estado,
      eventoId:    actualizado.eventoId,
      lockedByMe:  true,
      ttlSegundos: 300,
    };
  } catch {
    await unlockSeat(eventoId, asientoId, userId);
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

  const released = await unlockSeat(eventoId, asientoId, userId);
  if (!released) throw new Error('NO_TIENES_PERMISO_LIBERAR');

  const actualizado = await prisma.asiento.update({
    where: { id: asientoId },
    data:  { estado: EstadoAsiento.DISPONIBLE },
  });

  return {
    id:       actualizado.id,
    numero:   actualizado.numero,
    fila:     actualizado.fila,
    precio:   actualizado.precio,  // ✅
    estado:   actualizado.estado,
    eventoId: actualizado.eventoId,
  };
};

export const sincronizarAsientosExpirados = async (eventoId: string): Promise<number> => {
  const locks      = await getLockedSeatsForEvent(eventoId);
  const idsConLock = new Set(locks.map((l) => l.asientoId));

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
