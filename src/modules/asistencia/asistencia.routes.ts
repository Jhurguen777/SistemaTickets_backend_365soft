// src/modules/asistencia/asistencia.routes.ts
import { Router } from 'express';
import { authenticate, adminOnly } from '../../shared/middleware/auth';

const router = Router();

router.post('/validar', authenticate, adminOnly, (_req, res) => {
  res.json({ message: 'Validar QR de entrada' });
});

router.get('/evento/:id', authenticate, adminOnly, (_req, res) => {
  res.json({ message: 'Reporte de asistencia del evento' });
});

export default router;