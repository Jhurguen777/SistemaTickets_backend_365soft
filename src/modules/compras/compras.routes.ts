// src/modules/compras/compras.routes.ts
import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';

const router = Router();

// POST /api/compras/crear - Crear compra (Stripe)
router.post('/crear', authenticate, (req, res) => {
  res.json({ message: 'Crear compra con Stripe' });
});

// GET /api/compras/usuario - Obtener compras del usuario
router.get('/usuario', authenticate, (req, res) => {
  res.json({ message: 'Mis compras' });
});

// GET /api/compras/:id - Obtener detalle de compra
router.get('/:id', authenticate, (req, res) => {
  res.json({ message: 'Detalle de compra' });
});

// POST /api/compras/:id/reembolsar - Solicitar reembolso
router.post('/:id/reembolsar', authenticate, (req, res) => {
  res.json({ message: 'Solicitar reembolso' });
});

export default router;
