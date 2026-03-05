// src/modules/compras/qr-pagos.routes.ts

import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import {
  generarQr,
  verificarEstado,
  handleWebhook,
  cancelarQr,
} from './qr-pagos.controller';

const router = Router();

// ── Rutas PROTEGIDAS (requieren JWT) ─────────────────────────

// Generar QR para una compra
// POST /api/compras/qr/generar
// Body: { compraId: "uuid", monto: 150.00 }
router.post('/generar', authenticate, generarQr);

// Verificar estado del QR (polling cada 3s desde el frontend)
// GET /api/compras/qr/estado/:qrPagoId
router.get('/estado/:qrPagoId', authenticate, verificarEstado);

// Verificar estado del QR con query parameter (para compatibilidad con frontend)
// GET /api/compras/qr/verificar?id={qrPagoId}
router.get('/verificar', authenticate, verificarEstado);

// Cancelar QR pendiente
// DELETE /api/compras/qr/:qrPagoId
router.delete('/:qrPagoId', authenticate, cancelarQr);

// ── Ruta PÚBLICA (llamada por el banco MC4) ───────────────────

// ⚠️ Sin JWT - el banco llama aquí automáticamente cuando alguien paga
// POST /api/compras/qr/callback
router.post('/callback', handleWebhook);

export default router;
