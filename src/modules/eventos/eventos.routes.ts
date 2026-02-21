// src/modules/eventos/eventos.routes.ts
import { Router } from 'express';
import { authenticate, adminOnly } from '../../shared/middleware/auth';
import {
  getAllEventos,
  getEvento,
  createEventoController,
  updateEventoController,
  deleteEventoController,
} from './eventos.controller';

const router = Router();

// Listar eventos (público)
router.get('/', getAllEventos);

// Obtener evento por ID (público)
router.get('/:id', getEvento);

// Crear evento (solo admin)
router.post('/', authenticate, adminOnly, createEventoController);

// Actualizar evento (solo admin)
router.put('/:id', authenticate, adminOnly, updateEventoController);

// Eliminar evento (solo admin)
router.delete('/:id', authenticate, adminOnly, deleteEventoController);

export default router;
