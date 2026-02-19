// src/modules/admin/admin.routes.ts
import { Router } from 'express';
import { authenticate, adminOnly } from '../../shared/middleware/auth';

const router = Router();

router.get('/dashboard', authenticate, adminOnly, (_req, res) => {
  res.json({ message: 'Dashboard con métricas' });
});

router.get('/reports/ventas', authenticate, adminOnly, (_req, res) => {
  res.json({ message: 'Reporte de ventas' });
});

router.get('/reports/asistencia', authenticate, adminOnly, (_req, res) => {
  res.json({ message: 'Reporte de asistencia' });
});

router.get('/reports/agencias', authenticate, adminOnly, (_req, res) => {
  res.json({ message: 'Reporte por agencia' });
});

export default router;