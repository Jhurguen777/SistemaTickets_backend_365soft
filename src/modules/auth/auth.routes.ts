// src/modules/auth/auth.routes.ts
import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';

const router = Router();

// POST /api/auth/register - Registro con Google OAuth
router.post('/register', (req, res) => {
  res.json({ message: 'Registro endpoint - Implementar Google OAuth' });
});

// POST /api/auth/login - Login con Google OAuth
router.post('/login', (req, res) => {
  res.json({ message: 'Login endpoint - Implementar Google OAuth' });
});

// GET /api/auth/me - Obtener usuario actual
router.get('/me', authenticate, (req, res) => {
  res.json({ user: (req as any).user });
});

// POST /api/auth/google - Google OAuth callback
router.post('/google', (req, res) => {
  res.json({ message: 'Google OAuth callback - Implementar' });
});

export default router;
