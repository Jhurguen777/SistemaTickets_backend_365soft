// src/modules/admin/roles.routes.ts
import { Router } from 'express';
import { authenticate, adminOnly } from '../../shared/middleware/auth';
import {
  getRoles,
  getRol,
  postCreateRol,
  putUpdateRol,
  deleteRolHandler,
  postPromoverUsuario
} from './roles.controller';

const router = Router();

// Todas las rutas requieren autenticación y rol de admin
router.use(authenticate);
router.use(adminOnly);

// CRUD de roles
router.get('/', getRoles);
router.get('/:id', getRol);
router.post('/', postCreateRol);
router.post('/promover-usuario', postPromoverUsuario);
router.put('/:id', putUpdateRol);
router.delete('/:id', deleteRolHandler);

export default router;
