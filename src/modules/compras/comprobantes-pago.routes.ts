import { Router } from 'express';
import comprobantesPagoController from './comprobantes-pago.controller';
import { authenticate } from '../../shared/middleware/auth';

const router = Router();

// POST /api/compras/comprobantes-pago/subir
router.post(
  '/subir',
  authenticate,
  comprobantesPagoController.subirComprobante.bind(comprobantesPagoController)
);

// GET /api/compras/comprobantes-pago
router.get(
  '/',
  authenticate,
  comprobantesPagoController.listarComprobantes.bind(comprobantesPagoController)
);

// GET /api/compras/comprobantes-pago/:comprobanteId
router.get(
  '/:comprobanteId',
  authenticate,
  comprobantesPagoController.obtenerComprobante.bind(comprobantesPagoController)
);

// POST /api/compras/comprobantes-pago/:comprobanteId/aprobar
router.post(
  '/:comprobanteId/aprobar',
  authenticate,
  comprobantesPagoController.aprobarComprobante.bind(comprobantesPagoController)
);

// POST /api/compras/comprobantes-pago/:comprobanteId/rechazar
router.post(
  '/:comprobanteId/rechazar',
  authenticate,
  comprobantesPagoController.rechazarComprobante.bind(comprobantesPagoController)
);

export default router;