import { PrismaClient, EstadoAsiento } from '@prisma/client';
import { tryLockSeat, unlockSeat, getLockedSeatsForEvent } from './asientos.redis';

const prisma = new PrismaClient();

export interface AsientoConEstadoReal {
  id: string;
  numero: number;        
  fila: string;
  estado: EstadoAsiento | 'EN_PROCESO';
  eventoId: string;
  precio?: number;
  lockedByMe?: boolean;
  ttlSegundos?: number;
}

export const getAsientosPorEvento = async (
  eventoId: string,
  userId?: string
): Promise<AsientoConEstadoReal[]> => {
  const [asientos, locks] = await Promise.all([
    prisma.asiento.findMany({
      where: { eventoId },
      orderBy: [{ fila: 'asc' }, { numero: 'asc' }], // quitado seccion
    }),
    getLockedSeatsForEvent(eventoId),
  ]);

  const lockMap = new Map(locks.map((l) => [l.asientoId, l]));

  return asientos.map((a) => {
    const lock = lockMap.get(a.id);
    const estado = lock && a.estado === EstadoAsiento.DISPONIBLE ? 'EN_PROCESO' : a.estado;

    return {
      id: a.id,
      numero: a.numero,  // number directo, sin conversión
      fila: a.fila,
      estado: estado as EstadoAsiento | 'EN_PROCESO',
      eventoId: a.eventoId,
      ...(lock && {
        lockedByMe: userId ? lock.userId === userId : false,
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

  const locks = await getLockedSeatsForEvent(asiento.eventoId);
  const lock = locks.find((l) => l.asientoId === asientoId);
  const estado = lock && asiento.estado === EstadoAsiento.DISPONIBLE ? 'EN_PROCESO' : asiento.estado;

  return {
    id: asiento.id,
    numero: asiento.numero,
    fila: asiento.fila,
    estado: estado as EstadoAsiento | 'EN_PROCESO',
    eventoId: asiento.eventoId,
    ...(lock && {
      lockedByMe: userId ? lock.userId === userId : false,
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

  if (!asiento) throw new Error('ASIENTO_NO_ENCONTRADO');
  if (asiento.eventoId !== eventoId) throw new Error('ASIENTO_EVENTO_INVALIDO');
  if (asiento.estado !== EstadoAsiento.DISPONIBLE) throw new Error('ASIENTO_NO_DISPONIBLE');

  const locked = await tryLockSeat(eventoId, asientoId, userId);
  if (!locked) throw new Error('ASIENTO_EN_PROCESO');

  try {
    const actualizado = await prisma.asiento.update({
      where: { id: asientoId },
      data: { estado: EstadoAsiento.RESERVANDO }, // RESERVADO → RESERVANDO
    });

    return {
      id: actualizado.id,
      numero: actualizado.numero,
      fila: actualizado.fila,
      estado: actualizado.estado,
      eventoId: actualizado.eventoId,
      lockedByMe: true,
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

  if (!asiento) throw new Error('ASIENTO_NO_ENCONTRADO');
  if (asiento.estado !== EstadoAsiento.RESERVANDO) throw new Error('ASIENTO_NO_RESERVADO'); // RESERVADO → RESERVANDO

  const released = await unlockSeat(eventoId, asientoId, userId);
  if (!released) throw new Error('NO_TIENES_PERMISO_LIBERAR');

  const actualizado = await prisma.asiento.update({
    where: { id: asientoId },
    data: { estado: EstadoAsiento.DISPONIBLE },
  });

  return {
    id: actualizado.id,
    numero: actualizado.numero,
    fila: actualizado.fila,
    estado: actualizado.estado,
    eventoId: actualizado.eventoId,
  };
};

export const sincronizarAsientosExpirados = async (eventoId: string): Promise<number> => {
  const locks = await getLockedSeatsForEvent(eventoId);
  const idsConLock = new Set(locks.map((l) => l.asientoId));

  const huerfanos = await prisma.asiento.findMany({
    where: {
      eventoId,
      estado: EstadoAsiento.RESERVANDO, // RESERVADO → RESERVANDO
      id: { notIn: Array.from(idsConLock) },
    },
  });

  if (!huerfanos.length) return 0;

  await prisma.asiento.updateMany({
    where: { id: { in: huerfanos.map((a) => a.id) } },
    data: { estado: EstadoAsiento.DISPONIBLE },
  });

  return huerfanos.length;
};