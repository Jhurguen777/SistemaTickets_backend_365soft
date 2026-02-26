// src/modules/admin/roles.routes.ts
import { Router } from 'express';
import { authenticate, adminOnly } from '../../shared/middleware/auth';
import {
  getRoles,
  getRol,
  postCreateRol,
  putUpdateRol,
  deleteRolHandler
} from './roles.controller';

const router = Router();

// Todas las rutas requieren autenticación y rol de admin
router.use(authenticate);
router.use(adminOnly);

// CRUD de roles
router.get('/', getRoles);                    // Obtener todos los roles
router.get('/:id', getRol);                   // Obtener un rol por ID
router.post('/', postCreateRol);              // Crear un nuevo rol
router.put('/:id', putUpdateRol);             // Actualizar un rol
router.delete('/:id', deleteRolHandler);      // Eliminar un rol

export default router;
