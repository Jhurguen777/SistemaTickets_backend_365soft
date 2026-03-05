// src/shared/config/redis.ts
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

let redisConnected = false;

export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    connectTimeout: 10000, // 10 segundos para conectar
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('❌ Redis: máximo de reintentos alcanzado');
        return false;
      }
      const delay = Math.min(retries * 100, 3000); // 100ms a 3s
      console.log(`🔄 Redis: reconectando en ${delay}ms (intento ${retries})`);
      return delay;
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
    redisConnected = true;
    console.log('✅ Redis conectado correctamente');
  } catch (error) {
    console.error('❌ Error al conectar Redis:', error);
    redisConnected = false;
  }
}

// Conectar al inicio y mantener conexión
connectRedis();

// Manejo de errores - mostrar errores para debuggear
redisClient.on('error', (err) => {
  console.error('❌ Redis Client Error:', err.message);
  redisConnected = false;
});

redisClient.on('connect', () => {
  console.log('✅ Redis Client conectado');
  redisConnected = true;
});

redisClient.on('disconnect', () => {
  console.warn('⚠️ Redis Client desconectado');
  redisConnected = false;
});

redisClient.on('reconnecting', () => {
  console.log('🔄 Redis Client reconectando...');
});

redisPub.on('error', (err) => {
  console.error('❌ Redis Pub Error:', err.message);
});

redisPub.on('connect', () => {
  console.log('✅ Redis Pub conectado');
});

redisSub.on('error', (err) => {
  console.error('❌ Redis Sub Error:', err.message);
});

redisSub.on('connect', () => {
  console.log('✅ Redis Sub conectado');
});

// Verificar si Redis está conectado
export const isRedisConnected = (): boolean => {
  return redisConnected && redisClient.isOpen;
};

// Esperar a que Redis esté conectado (útil al inicio)
export const waitForRedis = async (timeout = 5000): Promise<boolean> => {
  const start = Date.now();
  while (!isRedisConnected() && Date.now() - start < timeout) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return isRedisConnected();
};

export default redisClient;
export { connectRedis, redisConnected };