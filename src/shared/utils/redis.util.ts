import redisClient from '../config/redis';

const LOCK_TTL = 300; // 5 minutos

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
  const key = buildSeatLockKey(eventoId, asientoId);
  const result = await redisClient.set(key, userId, { NX: true, EX: LOCK_TTL });
  return result === 'OK';
};

// Libera el lock solo si pertenece al userId. Usa Lua para atomicidad (check + delete en 1 op).
export const releaseSeatLock = async (
  eventoId: string,
  asientoId: string,
  userId: string
): Promise<boolean> => {
  const key = buildSeatLockKey(eventoId, asientoId);
  const lua = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `;
  const result = await redisClient.eval(lua, { keys: [key], arguments: [userId] });
  return result === 1;
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

// Borra el lock sin verificar dueño — solo para admins o rollbacks
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
  const keys = await redisClient.keys(`seat_lock:${eventoId}:*`);
  if (!keys.length) return [];

  const results = [];
  for (const key of keys) {
    const asientoId = key.split(':')[2];
    const userId = await redisClient.get(key);
    const ttl = await redisClient.ttl(key);
    if (userId) results.push({ asientoId, userId, ttl });
  }
  return results;
};