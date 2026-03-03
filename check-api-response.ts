import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAPIResponse() {
  console.log('🔍 Simulando respuesta de API /eventos...\n');

  const eventos = await prisma.evento.findMany({
    select: {
      id: true,
      titulo: true,
      imagenUrl: true,
      categoria: true,
      fecha: true,
      hora: true,
      ubicacion: true,
      precio: true
    },
    take: 3
  });

  console.log(`📋 Total eventos: ${eventos.length}\n`);

  eventos.forEach((evt: any, index: number) => {
    console.log(`\n🎪 Evento ${index + 1}: ${evt.titulo}`);
    console.log(`   ID: ${evt.id}`);
    console.log(`   imagenUrl existe: ${!!evt.imagenUrl}`);
    console.log(`   Longitud de imagenUrl: ${evt.imagenUrl?.length || 0} caracteres`);
    console.log(`   Primeros 100 chars: ${evt.imagenUrl?.substring(0, 100)}...`);
    console.log(`   Formato: ${evt.imagenUrl?.match(/^data:(\w+\/\w+);base64/)?.[1] || 'No reconocido'}`);
  });

  // Verificar si hay eventos con imagenUrl vacío
  const sinImagen = eventos.filter(e => !e.imagenUrl);
  console.log(`\n⚠️  Eventos sin imagen: ${sinImagen.length}/${eventos.length}`);
}

checkAPIResponse()
  .then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
  })
  .catch((err: any) => {
    console.error('Error:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
