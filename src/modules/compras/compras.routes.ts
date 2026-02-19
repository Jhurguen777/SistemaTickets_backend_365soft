// src/modules/compras/compras.routes.ts
import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';

const router = Router();

router.post('/crear', authenticate, (_req, res) => {
  res.json({ message: 'Crear compra con Stripe' });
});

router.get('/usuario', authenticate, (_req, res) => {
  res.json({ message: 'Mis compras' });
});

router.get('/:id', authenticate, (_req, res) => {
  res.json({ message: 'Detalle de compra' });
});

router.post('/:id/reembolsar', authenticate, (_req, res) => {
  res.json({ message: 'Solicitar reembolso' });
});

export default router;