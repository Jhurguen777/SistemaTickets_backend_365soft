import prisma from '../../shared/config/database';
import { EstadoAsiento } from '@prisma/client';
import { tryLockSeat, unlockSeat, getLockedSeatsForEvent } from './asientos.redis';

export interface AsientoConEstadoReal {
  id: string;
  numero: number;
  fila: string;
  precio: number | null;
  estado: EstadoAsiento | 'EN_PROCESO';
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
    getLocksSeguro(eventoId),  // ← ya no puede colgar
  ]);

  const lockMap = new Map(locks.map((l) => [l.asientoId, l]));

  return asientos.map((a) => {
    const lock  = lockMap.get(a.id);
    const estado = lock && a.estado === EstadoAsiento.DISPONIBLE ? 'EN_PROCESO' : a.estado;

    return {
      id:       a.id,
      numero:   a.numero,
      fila:     a.fila,
      precio:   a.precio,
      estado:   estado as EstadoAsiento | 'EN_PROCESO',
      eventoId: a.eventoId,
      ...(lock && {
        lockedByMe:  userId ? lock.userId === userId : false,
        ttlSegundos: lock.ttlSeconds,
      }),
    };
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
  const estado = lock && asiento.estado === EstadoAsiento.DISPONIBLE ? 'EN_PROCESO' : asiento.estado;

  return {
    id:       asiento.id,
    numero:   asiento.numero,
    fila:     asiento.fila,
    precio:   asiento.precio,
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