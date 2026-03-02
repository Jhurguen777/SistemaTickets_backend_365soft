// backend/scripts/setAdminPasswords.ts
// ─────────────────────────────────────────────────────────────
// Script ONE-TIME para asignar contraseña a los usuarios ADMIN
// que tienen password NULL en la tabla usuarios.
//
// USO (desde la carpeta backend/):
//   npx ts-node scripts/setAdminPasswords.ts
//
// Luego puedes eliminar este archivo.
// ─────────────────────────────────────────────────────────────

import prisma from '../src/shared/config/database';
import bcrypt from 'bcryptjs';

// Contraseñas específicas por email
const adminPasswords: Record<string, string> = {
  'administrador@gmail.com': 'superadmin',
  'admin@inmobiliaria.com':  'Admin2024!',   // ← cambia si quieres otra
};

async function main() {
  console.log('🔐 Asignando contraseñas a usuarios ADMIN...\n');

  for (const [email, password] of Object.entries(adminPasswords)) {
    const user = await prisma.usuario.findUnique({
      where: { email },
      select: { id: true, email: true, nombre: true, rol: true, password: true }
    });

    if (!user) {
      console.log(`⚠️  No encontrado: ${email}`);
      continue;
    }

    if (user.rol !== 'ADMIN') {
      console.log(`⚠️  ${email} no tiene rol ADMIN, se omite.`);
      continue;
    }

    if (user.password) {
      console.log(`⏭️  ${email} ya tiene contraseña, se omite. (borra esta línea si quieres forzar el cambio)`);
      continue;
    }

    const hashed = await bcrypt.hash(password, 10);

    await prisma.usuario.update({
      where: { email },
      data: { password: hashed }
    });

    console.log(`✅ ${user.nombre} (${email}) → contraseña asignada`);
  }

  console.log('\n🎉 Listo.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Error:', e);
  prisma.$disconnect();
  process.exit(1);
});