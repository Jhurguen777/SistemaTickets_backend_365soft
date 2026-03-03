import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkEventImages() {
  console.log('🔍 Buscando eventos...');

  const eventos = await prisma.evento.findMany({
    select: {
      id: true,
      titulo: true,
      imagenUrl: true,
      categoria: true
    },
    take: 10
  });

  console.log(`\n📋 Total eventos encontrados: ${eventos.length}\n`);

  eventos.forEach((evt: any) => {
    console.log(`🎪 ${evt.titulo}`);
    console.log(`   ID: ${evt.id}`);
    console.log(`   Categoría: ${evt.categoria || 'Sin categoría'}`);
    console.log(`   Imagen URL: ${evt.imagenUrl || '❌ SIN IMAGEN'}`);
    console.log('---');
  });
}

checkEventImages()
  .then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
  })
  .catch((err: any) => {
    console.error('Error:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
