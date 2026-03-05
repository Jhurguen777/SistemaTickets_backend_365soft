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

export interface BatchLockResult {
  success: boolean;
  failedIds: string[];
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

/**
 * Bloquea múltiples asientos atómicamente
 * Retorna éxito y lista de IDs que no se pudieron bloquear
 */
export const acquireBatchSeatLocks = async (
  eventoId: string,
  asientosIds: string[],
  userId: string
): Promise<BatchLockResult> => {
  const failedIds: string[] = [];

  for (const asientoId of asientosIds) {
    try {
      const locked = await tryLockSeat(eventoId, asientoId, userId);
      if (!locked) {
        failedIds.push(asientoId);
      }
    } catch (err) {
      console.warn(`⚠️ Error adquiriendo lock para asiento ${asientoId}:`, err);
      failedIds.push(asientoId);
    }
  }

  // Si alguno falló, liberar todos los que se bloquearon
  if (failedIds.length > 0) {
    await releaseBatchSeatLocksForce(eventoId, asientosIds);
    return { success: false, failedIds };
  }

  return { success: true, failedIds: [] };
};

/**
 * Libera múltiples asientos verificando que sean del usuario
 */
export const releaseBatchSeatLocks = async (
  eventoId: string,
  asientosIds: string[],
  userId: string
): Promise<void> => {
  for (const asientoId of asientosIds) {
    try {
      await unlockSeat(eventoId, asientoId, userId);
    } catch (err) {
      console.warn(`⚠️ Error liberando lock para asiento ${asientoId}:`, err);
    }
  }
};

/**
 * Libera múltiples asientos sin verificar dueño (forzado)
 */
export const releaseBatchSeatLocksForce = async (
  eventoId: string,
  asientosIds: string[]
): Promise<void> => {
  for (const asientoId of asientosIds) {
    try {
      await forceReleaseSeatLock(eventoId, asientoId);
    } catch (err) {
      console.warn(`⚠️ Error forzando liberación de asiento ${asientoId}:`, err);
    }
  }
};

/**
 * Extiende el TTL de un lock de asiento
 */
export const extendLockTTL = async (
  eventoId: string,
  asientoId: string,
  userId: string
): Promise<boolean> => {
  try {
    const owner = await getSeatLockOwner(eventoId, asientoId);
    if (!owner || owner !== userId) {
      return false;
    }

    // Extender el lock adquiriéndolo nuevamente
    const extended = await tryLockSeat(eventoId, asientoId, userId);
    return extended;
  } catch (err) {
    console.warn(`⚠️ Error extendiendo lock para asiento ${asientoId}:`, err);
    return false;
  }
};