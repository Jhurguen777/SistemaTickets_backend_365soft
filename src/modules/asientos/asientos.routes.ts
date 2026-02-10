// src/modules/asientos/asientos.routes.ts
import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';

const router = Router();

// GET /api/asientos/evento/:id - Obtener asientos de un evento
router.get('/evento/:id', (req, res) => {
  res.json({ message: 'Obtener asientos del evento' });
});

// POST /api/asientos/reservar - Reservar asiento (WebSocket)
router.post('/reservar', authenticate, (req, res) => {
  res.json({ message: 'Use WebSocket en su lugar' });
});

export default router;
