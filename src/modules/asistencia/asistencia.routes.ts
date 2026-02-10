// src/modules/asistencia/asistencia.routes.ts
import { Router } from 'express';
import { authenticate, adminOnly } from '../../shared/middleware/auth';

const router = Router();

// POST /api/asistencia/validar - Validar QR (admin only)
router.post('/validar', authenticate, adminOnly, (req, res) => {
  res.json({ message: 'Validar QR de entrada' });
});

// GET /api/asistencia/evento/:id - Reporte de asistencia
router.get('/evento/:id', authenticate, adminOnly, (req, res) => {
  res.json({ message: 'Reporte de asistencia del evento' });
});

export default router;
