import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...');

  // Limpiar datos existentes
  console.log('🗑️  Limpiando datos existentes...');
  await prisma.asistencia.deleteMany();
  await prisma.reembolso.deleteMany();
  await prisma.compra.deleteMany();
  await prisma.asiento.deleteMany();
  await prisma.evento.deleteMany();
  await prisma.usuario.deleteMany();

  // ============================================
  // 1. CREAR USUARIOS
  // ============================================
  console.log('👥 Creando usuarios...');

  const admin = await prisma.usuario.create({
    data: {
      email: 'admin@inmobiliaria.com',
      nombre: 'Admin Principal',
      telefono: '+591 70000001',
      agencia: 'Oficina Central',
      googleId: 'google_admin_123',
      rol: 'ADMIN',
    },
  });

  const usuarios = await prisma.usuario.createMany({
    data: [
      {
        email: 'juan.perez@gmail.com',
        nombre: 'Juan Pérez',
        telefono: '+591 70123456',
        agencia: 'La Paz Centro',
        googleId: 'google_user_001',
        rol: 'USUARIO',
      },
      {
        email: 'maria.garcia@gmail.com',
        nombre: 'María García',
        telefono: '+591 70234567',
        agencia: 'La Paz Sur',
        googleId: 'google_user_002',
        rol: 'USUARIO',
      },
      {
        email: 'carlos.rodriguez@gmail.com',
        nombre: 'Carlos Rodríguez',
        telefono: '+591 70345678',
        agencia: 'Zona Sopocachi',
        googleId: 'google_user_003',
        rol: 'USUARIO',
      },
    ],
  });

  console.log(`✅ Creados ${usuarios.count + 1} usuarios`);

  // ============================================
  // 2. CREAR EVENTO
  // ============================================
  console.log('🎪 Creando evento...');

  const evento = await prisma.evento.create({
    data: {
      titulo: 'Feria Inmobiliaria 2025 - La Paz',
      descripcion:
        'Gran feria de bienes raíces con las mejores oportunidades de inversión',
      fecha: new Date('2025-03-15T09:00:00'),
      hora: '09:00',
      ubicacion: 'Centro de Convenciones La Paz',
      imagenUrl: 'https://example.com/evento.jpg',
      capacidad: 600,
      precio: 150.0,
      estado: 'ACTIVO',
    },
  });

  console.log(`✅ Evento creado: ${evento.titulo}`);

  // ============================================
  // 3. CREAR ASIENTOS (10 filas x 60 asientos = 600)
  // ============================================
  console.log('💺 Creando asientos...');

  const filas = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const asientosData = [];

  for (const fila of filas) {
    for (let num = 1; num <= 60; num++) {
      asientosData.push({
        eventoId: evento.id,
        fila,
        numero: num,
        estado: 'DISPONIBLE' as const,
      });
    }
  }

  await prisma.asiento.createMany({
    data: asientosData,
  });

  console.log(`✅ Creados 600 asientos`);

  // ============================================
  // 4. CREAR COMPRAS DE EJEMPLO
  // ============================================
  console.log('🎫 Creando compras de ejemplo...');

  const allUsers = await prisma.usuario.findMany({
    where: { rol: 'USUARIO' },
  });

  const asientosParaVender = await prisma.asiento.findMany({
    where: { eventoId: evento.id },
    take: 5,
  });

  for (let i = 0; i < Math.min(3, asientosParaVender.length); i++) {
    const asiento = asientosParaVender[i];
    const usuario = allUsers[i % allUsers.length];

    // Actualizar asiento a VENDIDO
    await prisma.asiento.update({
      where: { id: asiento.id },
      data: { estado: 'VENDIDO' },
    });

    // Crear compra
    await prisma.compra.create({
      data: {
        usuarioId: usuario.id,
        eventoId: evento.id,
        asientoId: asiento.id,
        monto: evento.precio,
        moneda: 'USD',
        metodoPago: 'STRIPE',
        estadoPago: 'PAGADO',
        stripePaymentId: `pi_test_${Math.random().toString(36).substring(7)}`,
        qrCode: `QR-${asiento.fila}${asiento.numero}-${Date.now()}`,
        qrCodeUsado: false,
      },
    });
  }

  console.log(`✅ Creadas 3 compras de ejemplo`);

  // ============================================
  // 5. BLOQUEAR ALGUNOS ASIENTOS (Ejemplo)
  // ============================================
  console.log('🔒 Bloqueando asientos VIP...');

  // Bloquear primera fila (A1-A10) como VIP
  await prisma.asiento.updateMany({
    where: {
      eventoId: evento.id,
      fila: 'A',
      numero: { lte: 10 },
    },
    data: {
      estado: 'BLOQUEADO',
    },
  });

  console.log(`✅ Bloqueados 10 asientos VIP`);

  // ============================================
  // 6. CREAR ASISTENCIA (1 persona ya ingresó)
  // ============================================
  console.log('✅ Registrando asistencia de ejemplo...');

  const primeraCompra = await prisma.compra.findFirst({
    where: { estadoPago: 'PAGADO' },
  });

  if (primeraCompra) {
    await prisma.asistencia.create({
      data: {
        compraId: primeraCompra.id,
        usuarioId: primeraCompra.usuarioId,
        ingresoEn: new Date(),
        validadoPor: admin.id,
        ubicacionGPS: '-16.5000, -68.1500', // La Paz coords
        dispositivoId: 'scanner-001',
      },
    });

    console.log(`✅ Asistencia registrada`);
  }

  // ============================================
  // 7. CREAR REEMBOLSO DE EJEMPLO
  // ============================================
  console.log('💸 Creando reembolso de ejemplo...');

  const segundaCompra = await prisma.compra.findMany({
    where: { estadoPago: 'PAGADO' },
    skip: 1,
    take: 1,
  });

  if (segundaCompra.length > 0) {
    await prisma.reembolso.create({
      data: {
        compraId: segundaCompra[0].id,
        monto: segundaCompra[0].monto,
        razon: 'Usuario no puede asistir',
        estado: 'SOLICITADO',
        solicitadoEn: new Date(),
      },
    });

    console.log(`✅ Reembolso creado`);
  }

  // ============================================
  // 8. RESUMEN
  // ============================================
  console.log('\n📊 RESUMEN DEL SEED:');
  console.log('═══════════════════════════════════════');

  const stats = {
    usuarios: await prisma.usuario.count(),
    eventos: await prisma.evento.count(),
    asientos: await prisma.asiento.count(),
    disponibles: await prisma.asiento.count({
      where: { estado: 'DISPONIBLE' },
    }),
    vendidos: await prisma.asiento.count({ where: { estado: 'VENDIDO' } }),
    bloqueados: await prisma.asiento.count({ where: { estado: 'BLOQUEADO' } }),
    compras: await prisma.compra.count(),
    asistencias: await prisma.asistencia.count(),
    reembolsos: await prisma.reembolso.count(),
  };

  console.log(`👥 Usuarios: ${stats.usuarios}`);
  console.log(`🎪 Eventos: ${stats.eventos}`);
  console.log(`💺 Asientos totales: ${stats.asientos}`);
  console.log(`   ├─ Disponibles: ${stats.disponibles}`);
  console.log(`   ├─ Vendidos: ${stats.vendidos}`);
  console.log(`   └─ Bloqueados: ${stats.bloqueados}`);
  console.log(`🎫 Compras: ${stats.compras}`);
  console.log(`✅ Asistencias: ${stats.asistencias}`);
  console.log(`💸 Reembolsos: ${stats.reembolsos}`);
  console.log('═══════════════════════════════════════');

  console.log('\n🔑 CREDENCIALES DE PRUEBA:');
  console.log('═══════════════════════════════════════');
  console.log('Admin:');
  console.log(`  Email: ${admin.email}`);
  console.log(`  Google ID: ${admin.googleId}`);
  console.log(`  Rol: ${admin.rol}\n`);

  console.log('💡 PRÓXIMOS PASOS:');
  console.log('═══════════════════════════════════════');
  console.log('1. Ejecuta: npx prisma studio');
  console.log('2. Abre: http://localhost:5555');
  console.log('3. Explora los datos creados\n');

  console.log('✨ Seed completado exitosamente!\n');
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });