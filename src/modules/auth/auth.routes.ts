// src/modules/auth/auth.routes.ts
import { Router } from 'express';
import passport from './passport.config';
import { authenticate } from '../../shared/middleware/auth';
import { googleCallback, completeProfile, getMe, logout, loginLocal } from './auth.controller';

const router = Router();

// Login local (solo para desarrollo)
router.post('/login', loginLocal);

// Paso 1: Redirigir a Google — bypass de Passport para la redirección
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

router.post('/complete-profile', authenticate, completeProfile);
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

export default router;