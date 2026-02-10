// src/modules/eventos/eventos.routes.ts
import { Router } from 'express';
import { authenticate, adminOnly } from '../../shared/middleware/auth';

const router = Router();

// GET /api/eventos - Listar todos los eventos
router.get('/', (req, res) => {
  res.json({ message: 'Listar eventos' });
});

// GET /api/eventos/:id - Obtener detalle de un evento
router.get('/:id', (req, res) => {
  res.json({ message: 'Detalle de evento' });
});

// POST /api/eventos - Crear evento (admin only)
router.post('/', authenticate, adminOnly, (req, res) => {
  res.json({ message: 'Crear evento' });
});

// PUT /api/eventos/:id - Actualizar evento (admin only)
router.put('/:id', authenticate, adminOnly, (req, res) => {
  res.json({ message: 'Actualizar evento' });
});

// DELETE /api/eventos/:id - Eliminar evento (admin only)
router.delete('/:id', authenticate, adminOnly, (req, res) => {
  res.json({ message: 'Eliminar evento' });
});

export default router;
