// src/modules/asientos/asientos.routes.ts
import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';

const router = Router();

router.get('/evento/:id', (_req, res) => {
  res.json({ message: 'Obtener asientos del evento' });
});

router.post('/reservar', authenticate, (_req, res) => {
  res.json({ message: 'Use WebSocket en su lugar' });
});

export default router;