// src/modules/admin/admin.routes.ts
import { Router } from 'express';
import { authenticate, adminOnly } from '../../shared/middleware/auth';

const router = Router();

// GET /api/admin/dashboard - Métricas generales
router.get('/dashboard', authenticate, adminOnly, (req, res) => {
  res.json({ message: 'Dashboard con métricas' });
});

// GET /api/admin/reports/ventas - Reporte de ventas
router.get('/reports/ventas', authenticate, adminOnly, (req, res) => {
  res.json({ message: 'Reporte de ventas' });
});

// GET /api/admin/reports/asistencia - Reporte de asistencia
router.get('/reports/asistencia', authenticate, adminOnly, (req, res) => {
  res.json({ message: 'Reporte de asistencia' });
});

// GET /api/admin/reports/agencias - Reporte por agencia
router.get('/reports/agencias', authenticate, adminOnly, (req, res) => {
  res.json({ message: 'Reporte por agencia' });
});

export default router;
