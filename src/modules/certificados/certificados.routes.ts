// src/modules/certificados/certificados.routes.ts
import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';

const router = Router();

// GET /api/certificados/:compraId - Descargar certificado
router.get('/:compraId', authenticate, (req, res) => {
  res.json({ message: 'Descargar certificado PDF' });
});

// POST /api/certificados/enviar - Reenviar certificado por email
router.post('/enviar', authenticate, (req, res) => {
  res.json({ message: 'Reenviar certificado' });
});

export default router;
