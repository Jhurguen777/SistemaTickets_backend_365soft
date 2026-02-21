// src/modules/admin/admin.routes.ts
import { Router } from 'express';
import { authenticate, adminOnly } from '../../shared/middleware/auth';
import {
  getDashboard,
  getSales,
  getAttendance,
  getAgencies,
  exportData,
} from './admin.controller';

const router = Router();

// Dashboard
router.get('/dashboard', authenticate, adminOnly, getDashboard);

// Reportes
router.get('/reports/ventas', authenticate, adminOnly, getSales);
router.get('/reports/asistencia', authenticate, adminOnly, getAttendance);
router.get('/reports/agencias', authenticate, adminOnly, getAgencies);

// Exportación
router.get('/export', authenticate, adminOnly, exportData);

export default router;