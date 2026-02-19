// src/modules/certificados/certificados.routes.ts
import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';

const router = Router();

router.get('/:compraId', authenticate, (_req, res) => {
  res.json({ message: 'Descargar certificado PDF' });
});

router.post('/enviar', authenticate, (_req, res) => {
  res.json({ message: 'Reenviar certificado' });
});

export default router;