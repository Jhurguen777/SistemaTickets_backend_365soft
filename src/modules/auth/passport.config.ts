// src/modules/auth/passport.config.ts
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from '../../shared/config/database';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
      scope: ['profile', 'email'],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const googleId = profile.id;

        if (!email) {
          return done(new Error('No se pudo obtener el email de Google'), undefined);
        }

        // 🔥 EXTRAER NOMBRE Y APELLIDO DE GOOGLE
        let nombre = '';
        let apellido = '';

        // Intentar usar givenName y family_name (más confiable)
        if (profile.name?.givenName && profile.name?.familyName) {
          nombre = profile.name.givenName;
          apellido = profile.name.familyName;
        }
        // Fallback a displayName (separar por espacio)
        else if (profile.displayName) {
          const partes = profile.displayName.trim().split(/\s+/);
          if (partes.length >= 2) {
            nombre = partes[0];
            apellido = partes.slice(1).join(' ');
          } else {
            nombre = profile.displayName;
            apellido = '';
          }
        }

        let usuario = await prisma.usuario.findFirst({
          where: { OR: [{ email }, { googleId }] }
        });

        if (usuario) {
          if (!usuario.googleId && googleId) {
            usuario = await prisma.usuario.update({
              where: { id: usuario.id },
              data: { googleId }
            });
          }
          console.log(`✅ Usuario existente autenticado: ${email}`);
          return done(null, {
            id: usuario.id,
            email: usuario.email,
            nombre: usuario.nombre || undefined,
            apellido: usuario.apellido || undefined,
            isAdmin: false
          });
        }

        // 🔥 CREAR USUARIO CON NOMBRE Y APELLIDO SEPARADOS
        const nuevoUsuario = await prisma.usuario.create({
          data: {
            email,
            nombre,
            apellido,
            googleId,
            telefono: '',
            agencia: '',
          }
        });

        console.log(`✅ Nuevo usuario creado: ${email} - Nombre: ${nombre}, Apellido: ${apellido}`);
        return done(null, {
          id: nuevoUsuario.id,
          email: nuevoUsuario.email,
          nombre: nuevoUsuario.nombre || undefined,
          apellido: nuevoUsuario.apellido || undefined,
          isAdmin: false
        });

      } catch (error) {
        console.error('❌ Error en autenticación con Google:', error);
        return done(error as Error, undefined);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, (user as any).id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        rol: true,
        activo: true,
        googleId: true,
        telefono: true,
        agencia: true,
        createdAt: true
      }
    });

    if (!usuario) {
      return done(null, null);
    }

    done(null, {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre || undefined,
      apellido: usuario.apellido || undefined,
      isAdmin: usuario.rol === 'ADMIN'
    });
  } catch (error) {
    done(error, null);
  }
});

export default passport;