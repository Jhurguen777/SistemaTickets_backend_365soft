// src/modules/admin/admin.routes.ts
import { Router } from 'express';
import { authenticate, adminOnly } from '../../shared/middleware/auth';
import {
  getDashboard,
  getSales,
  getAttendance,
  getAgencies,
  exportData,
  getUsers,
  getUserPurchasesHandler,
} from './admin.controller';
import rolesRoutes from './roles.routes';

const router = Router();

// Dashboard
router.get('/dashboard', authenticate, adminOnly, getDashboard);

// Reportes
router.get('/reports/ventas', authenticate, adminOnly, getSales);
router.get('/reports/asistencia', authenticate, adminOnly, getAttendance);
router.get('/reports/agencias', authenticate, adminOnly, getAgencies);

// Exportación
router.get('/export', authenticate, adminOnly, exportData);

// Usuarios
router.get('/users', authenticate, adminOnly, getUsers);
router.get('/users/:userId/purchases', authenticate, adminOnly, getUserPurchasesHandler);

// Roles (Administradores)
router.use('/roles', rolesRoutes);

export default router;