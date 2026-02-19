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
      // ← SIN scope aquí
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const nombre = profile.displayName;
        const googleId = profile.id;

        if (!email) {
          return done(new Error('No se pudo obtener el email de Google'), undefined);
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
          return done(null, usuario);
        }

        const nuevoUsuario = await prisma.usuario.create({
          data: {
            email,
            nombre,
            googleId,
            telefono: '',
            agencia: '',
            rol: 'USUARIO'
          }
        });

        console.log(`✅ Nuevo usuario creado: ${email}`);
        return done(null, nuevoUsuario);

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
    const usuario = await prisma.usuario.findUnique({ where: { id } });
    done(null, usuario);
  } catch (error) {
    done(error, null);
  }
});

export default passport;