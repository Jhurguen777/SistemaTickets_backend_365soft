// src/modules/eventos/eventos.routes.ts
import { Router } from 'express';
import { authenticate, adminOnly } from '../../shared/middleware/auth';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ message: 'Listar eventos' });
});

router.get('/:id', (_req, res) => {
  res.json({ message: 'Detalle de evento' });
});

router.post('/', authenticate, adminOnly, (_req, res) => {
  res.json({ message: 'Crear evento' });
});

router.put('/:id', authenticate, adminOnly, (_req, res) => {
  res.json({ message: 'Actualizar evento' });
});

router.delete('/:id', authenticate, adminOnly, (_req, res) => {
  res.json({ message: 'Eliminar evento' });
});

export default router;