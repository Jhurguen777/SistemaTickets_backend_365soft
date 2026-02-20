import {
  acquireSeatLock,
  releaseSeatLock,
  getSeatLockOwner,
  getSeatLockTTL,
  getEventActiveLocks,
  forceReleaseSeatLock,
} from '../../shared/utils/redis.util';

export interface SeatLockInfo {
  isLocked: boolean;
  lockedByCurrentUser: boolean;
  ttlSeconds: number | null;
}
export interface RawLock {
  asientoId: string;
  userId: string;
  ttl: number;
}

export interface LockedSeat {
  asientoId: string;
  userId: string;
  ttlSeconds: number;
}

// Intenta bloquear el asiento. false = ya está tomado por otro usuario
export const tryLockSeat = (eventoId: string, asientoId: string, userId: string) =>
  acquireSeatLock(eventoId, asientoId, userId);

// Libera el lock verificando que sea del usuario. false = no le pertenece
export const unlockSeat = (eventoId: string, asientoId: string, userId: string) =>
  releaseSeatLock(eventoId, asientoId, userId);

// Estado actual del lock de un asiento
export const getSeatLockInfo = async (
  eventoId: string,
  asientoId: string,
  userId?: string
): Promise<SeatLockInfo> => {
  const owner = await getSeatLockOwner(eventoId, asientoId);
  if (!owner) return { isLocked: false, lockedByCurrentUser: false, ttlSeconds: null };

  const ttl = await getSeatLockTTL(eventoId, asientoId);
  return {
    isLocked: true,
    lockedByCurrentUser: userId ? owner === userId : false,
    ttlSeconds: ttl > 0 ? ttl : null,
  };
};

// Todos los asientos bloqueados de un evento (para combinar con estado de BD)
export const getLockedSeatsForEvent = async (eventoId: string): Promise<LockedSeat[]> => {
  const locks = await getEventActiveLocks(eventoId);
  return locks.map((l: RawLock) => ({ asientoId: l.asientoId, userId: l.userId, ttlSeconds: l.ttl }));
};

// Solo para admins — libera sin verificar dueño
export const adminForceUnlockSeat = (eventoId: string, asientoId: string) =>
  forceReleaseSeatLock(eventoId, asientoId);