// src/modules/auth/auth.routes.ts
import { Router, RequestHandler } from 'express';
import passport from './passport.config';
import { authenticate } from '../../shared/middleware/auth';
import { googleCallback, completeProfile, getMe, logout, loginLocal, register } from './auth.controller';

const router = Router();

// Cast para compatibilidad de tipos entre AuthRequest y Request de Express
const auth = authenticate as unknown as RequestHandler;

// Registro local
router.post('/register', register);

// Login local (solo para desarrollo)
router.post('/login', loginLocal);

// Paso 1: Redirigir a Google
router.get('/google', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_CALLBACK_URL!,
    response_type: 'code',
    scope: 'profile email',
    access_type: 'offline',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// Paso 2: Callback — Passport maneja la verificación
router.get('/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/auth/error`,
  }),
  googleCallback
);

router.post('/complete-profile', auth, completeProfile);
router.get('/me', auth, getMe);
router.post('/logout', auth, logout);

export default router;