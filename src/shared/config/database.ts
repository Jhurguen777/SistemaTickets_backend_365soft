// src/shared/config/database.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});

// Test de conexión
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

// Manejo de shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
