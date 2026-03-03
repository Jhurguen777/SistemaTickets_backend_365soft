import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSeats() {
  const eventoId = '273a2686-6815-4239-b59e-de6721a295b1';

  console.log('🔍 Buscando asientos del evento...');

  const total = await prisma.asiento.count({
    where: { eventoId }
  });

  console.log(`Total asientos en BD: ${total}`);

  if (total === 0) {
    console.log('❌ NO hay asientos en la BD');
    console.log('📝 Necesitas generar los asientos primero');
    return;
  }

  const ejemplos = await prisma.asiento.findMany({
    where: { eventoId },
    take: 10,
    orderBy: { fila: 'asc' }
  });

  console.log('\n📋 Ejemplos de asientos en BD:');
  ejemplos.forEach((a: any) => {
    console.log(`  ID: ${a.id}`);
    console.log(`  Fila: ${a.fila}, Número: ${a.numero}`);
    console.log(`  Estado: ${a.estado}`);
    console.log(`  Key: ${a.fila}-${a.numero}`);
    console.log('---');
  });
}

checkSeats()
  .then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
  })
  .catch((err: any) => {
    console.error('Error:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
