// src/shared/config/database.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});

async function testConnection() {
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL conectado correctamente');
  } catch (error) {
    console.error('❌ Error conectando a PostgreSQL:', error);
    process.exit(1);
  }
}

testConnection();

// Shutdown limpio en SIGINT (Ctrl+C) y SIGTERM (Docker/PM2)
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default prisma;