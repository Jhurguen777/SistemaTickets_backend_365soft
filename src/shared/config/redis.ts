// src/shared/config/redis.ts
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 3) return false; // ← deja de intentar después de 3 intentos
      return Math.min(retries * 50, 500);
    },
  },
});

export const redisPub = redisClient.duplicate();
export const redisSub = redisClient.duplicate();

async function connectRedis() {
  try {
    await redisClient.connect();
    await redisPub.connect();
    await redisSub.connect();
    console.log('✅ Redis conectado correctamente');
  } catch (error) {
    console.warn('⚠️  Redis no disponible — continuando sin cache/WebSocket adapter');
  }
}

connectRedis();

// Un solo log de error, no spam
redisClient.on('error', () => {}); // silencioso después del intento inicial
redisPub.on('error', () => {});
redisSub.on('error', () => {});

export default redisClient;
export {connectRedis };