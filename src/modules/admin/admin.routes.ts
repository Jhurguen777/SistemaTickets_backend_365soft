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
  getEventUsersHandler,
} from './admin.controller';
import rolesRoutes from './roles.routes';
import { getActividades, getSesionesActivas } from './logs.service';
import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';

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

// Eventos
router.get('/events/:eventId/users', authenticate, adminOnly, getEventUsersHandler);

// Logs de actividad
router.get('/logs', authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const logs = await getActividades();
    res.json({ success: true, data: logs });
  } catch {
    res.status(500).json({ error: 'Error al obtener logs' });
  }
});

// Sesiones activas
router.get('/sesiones', authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const sesiones = await getSesionesActivas();
    res.json({ success: true, data: sesiones });
  } catch {
    res.status(500).json({ error: 'Error al obtener sesiones' });
  }
});

// Roles (Administradores)
router.use('/roles', rolesRoutes);

export default router;