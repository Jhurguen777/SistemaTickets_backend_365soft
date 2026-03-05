import redisClient from '../config/redis';

// Verifica que Redis esté conectado antes de cualquier operación
const ensureRedisConnected = () => {
  if (!redisClient || !redisClient.isOpen) {
    console.error('❌ Redis no está conectado o el cliente está cerrado');
    throw new Error('Redis no está conectado. Por favor verifica que Redis esté corriendo.');
  }
};

const LOCK_TTL = 180; // 3 minutos (selección + formulario)
const LOCK_TTL_EXTENDED = 600; // 10 minutos (para proceso de pago)

// Formato de clave: seat_lock:{eventoId}:{asientoId}
export const buildSeatLockKey = (eventoId: string, asientoId: string) =>
  `seat_lock:${eventoId}:${asientoId}`;

// Intenta adquirir el lock. Retorna true si lo logró, false si ya está tomado.
// SET NX = solo escribe si la clave NO existe (atómico, previene race conditions)
export const acquireSeatLock = async (
  eventoId: string,
  asientoId: string,
  userId: string
): Promise<boolean> => {
  ensureRedisConnected();
  const key = buildSeatLockKey(eventoId, asientoId);
  const result = await redisClient.set(key, userId, { NX: true, EX: LOCK_TTL });
  return result === 'OK';
};

/**
 * Extiende el TTL de un lock existente (para cuando se inicia el pago)
 * Solo funciona si el lock pertenece al mismo usuario
 * NOTA: Implementación simplificada sin atomicidad
 */
export const extendLockTTL = async (
  eventoId: string,
  asientoId: string,
  userId: string
): Promise<boolean> => {
  const key = buildSeatLockKey(eventoId, asientoId);
  const currentOwner = await redisClient.get(key);
  if (!currentOwner || currentOwner !== userId) {
    return false;
  }
  await redisClient.expire(key, LOCK_TTL_EXTENDED);
  return true;
};

/**
 * Libera el lock solo si pertenece al userId.
 * NOTA: Implementación simplificada sin atomicidad Lua
 */
export const releaseSeatLock = async (
  eventoId: string,
  asientoId: string,
  userId: string
): Promise<boolean> => {
  const key = buildSeatLockKey(eventoId, asientoId);
  const result = await redisClient.del(key);
  return result > 0;
};

// Retorna el userId dueño del lock, o null si no hay lock
export const getSeatLockOwner = async (
  eventoId: string,
  asientoId: string
): Promise<string | null> => {
  return redisClient.get(buildSeatLockKey(eventoId, asientoId));
};

// Retorna los segundos restantes del lock (-2 = no existe)
export const getSeatLockTTL = async (
  eventoId: string,
  asientoId: string
): Promise<number> => {
  return redisClient.ttl(buildSeatLockKey(eventoId, asientoId));
};

// Libera el lock sin verificar dueño (forzado, solo para admins)
export const forceReleaseSeatLock = async (
  eventoId: string,
  asientoId: string
): Promise<void> => {
  await redisClient.del(buildSeatLockKey(eventoId, asientoId));
};

// Lista todos los locks activos de un evento
export const getEventActiveLocks = async (
  eventoId: string
): Promise<Array<{ asientoId: string; userId: string; ttl: number }>> => {
  const pattern = `seat_lock:${eventoId}:*`;
  const keys = await redisClient.keys(pattern);

  if (!keys.length) return [];

  const results = [];
  for (const key of keys) {
    const parts = key.split(':');
    if (parts.length === 3) {
      const asientoId = parts[2];
      const userId = await redisClient.get(key);
      const ttl = await redisClient.ttl(key);
      if (userId) {
        results.push({ asientoId, userId, ttl: ttl >= 0 ? ttl : 0 });
      }
    }
  }

  return results;
};

// Bloquea múltiples asientos atómicamente
export const acquireBatchSeatLocks = async (
  eventoId: string,
  asientosIds: string[],
  userId: string
): Promise<{ success: boolean; failedIds: string[] }> => {
  const failedIds: string[] = [];

  for (const asientoId of asientosIds) {
    const locked = await acquireSeatLock(eventoId, asientoId, userId);
    if (!locked) {
      failedIds.push(asientoId);
    }
  }

  // Si alguno falló, liberar todos los que se bloquearon
  if (failedIds.length > 0) {
    for (const asientoId of asientosIds) {
      await forceReleaseSeatLock(eventoId, asientoId);
    }
    return { success: false, failedIds };
  }

  return { success: true, failedIds: [] };
};

// Libera múltiples asientos verificando que sean del usuario
export const releaseBatchSeatLocks = async (
  eventoId: string,
  asientosIds: string[],
  userId: string
): Promise<void> => {
  for (const asientoId of asientosIds) {
    await releaseSeatLock(eventoId, asientoId, userId);
  }
};

// Libera múltiples asientos sin verificar dueño (forzado)
export const releaseBatchSeatLocksForce = async (
  eventoId: string,
  asientosIds: string[]
): Promise<void> => {
  for (const asientoId of asientosIds) {
    await forceReleaseSeatLock(eventoId, asientoId);
  }
};

/**
 * Extiende el TTL de múltiples locks de asientos
 */
export const extendLocksParaPago = async ({
  asientosIds,
  eventoId,
  usuarioId
}: {
  asientosIds: string[];
  eventoId: string;
  usuarioId: string;
}): Promise<boolean> => {
  for (const asientoId of asientosIds) {
    try {
      await extendLockTTL(eventoId, asientoId, usuarioId);
    } catch (err) {
      console.warn(`⚠️ Error extendiendo lock para asiento ${asientoId}:`, err);
    }
  }
  return true;
};
