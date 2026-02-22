// src/modules/compras/compras.routes.ts
import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import comprasController from './compras.controller';

const router = Router();

/**
 * @route   POST /api/compras/iniciar-pago
 * @desc    Iniciar proceso de pago con QR
 * @access  Private (Usuario autenticado)
 */
router.post('/iniciar-pago', authenticate, comprasController.iniciarPago);

/**
 * @route   GET /api/compras/verificar-pago/:qrId
 * @desc    Verificar estado de pago QR
 * @access  Private (Usuario autenticado)
 */
router.get('/verificar-pago/:qrId', authenticate, comprasController.verificarPago);

/**
 * @route   GET /api/compras/mis-compras
 * @desc    Obtener todas las compras del usuario
 * @access  Private (Usuario autenticado)
 * @query   page - Página (default: 1)
 * @query   limit - Límite por página (default: 10)
 */
router.get('/mis-compras', authenticate, comprasController.obtenerMisCompras);

/**
 * @route   GET /api/compras/qr/:qrId
 * @desc    Obtener detalles de un QR
 * @access  Private (Usuario autenticado)
 */
router.get('/qr/:qrId', authenticate, comprasController.obtenerQr);

/**
 * @route   POST /api/compras/cancelar-qr/:qrId
 * @desc    Cancelar QR pendiente
 * @access  Private (Usuario autenticado)
 */
router.post('/cancelar-qr/:qrId', authenticate, comprasController.cancelarQr);

/**
 * @route   GET /api/compras/:compraId
 * @desc    Obtener detalle de compra
 * @access  Private (Usuario autenticado)
 */
router.get('/:compraId', authenticate, comprasController.obtenerCompraDetalle);

/**
 * @route   POST /api/compras/webhook-qr
 * @desc    Webhook del banco para notificaciones de pago
 * @access  Public (sin autenticación, el banco envía notificaciones)
 */
router.post('/webhook-qr', comprasController.webhookBanco);

/**
 * @route   POST /api/compras/limpiar-vencidos
 * @desc    Limpiar QRs vencidos (cron job)
 * @access  Private (Admin o Internal Cron)
 */
router.post('/limpiar-vencidos', authenticate, comprasController.limpiarQrsVencidos);

export default router;