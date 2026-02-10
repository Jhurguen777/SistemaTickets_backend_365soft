// src/shared/config/redis.ts
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

// Cliente principal
export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500),
  },
});

// Clientes para Pub/Sub (Socket.IO Adapter)
export const redisPub = redisClient.duplicate();
export const redisSub = redisClient.duplicate();

// Conectar todos
async function connectRedis() {
  try {
    await redisClient.connect();
    await redisPub.connect();
    await redisSub.connect();
    console.log('✅ Redis conectado correctamente');
  } catch (error) {
    console.error('❌ Error conectando a Redis:', error);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn('⚠️  Continuando sin Redis (modo desarrollo)');
    }
  }
}

connectRedis();

// Manejo de errores
redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisPub.on('error', (err) => console.error('Redis Pub Error:', err));
redisSub.on('error', (err) => console.error('Redis Sub Error:', err));
