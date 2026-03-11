// src/modules/compras/compras.routes.ts
import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import comprasController from './compras.controller';
import { handleWebhook } from './qr-pagos.controller';

const router = Router();

/**
 * @route   POST /api/compras/crear-con-reserva
 * @desc    Crear compra con datos de asistentes y generar QR en un solo paso
 * @access  Private (Usuario autenticado)
 */
router.post('/crear-con-reserva', authenticate, comprasController.crearConReserva);

/**
 * @route   POST /api/compras/crear-general
 * @desc    Crear boletos generales (modo CANTIDAD) — sin asientos asignados
 * @access  Private (Usuario autenticado)
 */
router.post('/crear-general', authenticate, comprasController.crearCompraGeneral);

/**
 * @route   POST /api/compras/iniciar-pago
 * @desc    Iniciar proceso de pago con QR (legacy, sin datos de asistente)
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
 * @route   GET /api/compras/qr/info/:qrId
 * @desc    Obtener detalles de un QR
 * @access  Private (Usuario autenticado)
 */
router.get('/qr/info/:qrId', authenticate, comprasController.obtenerQr);

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
 * @route   POST /api/compras/webhook/banco
 * @desc    Webhook del banco para notificaciones de pago
 * @access  Public (sin autenticación, el banco envía notificaciones)
 */
router.post('/webhook/banco', handleWebhook);

/**
 * @route   POST /api/compras/limpiar-vencidos
 * @desc    Limpiar QRs vencidos (cron job)
 * @access  Private (Admin o Internal Cron)
 */
router.post('/limpiar-vencidos', authenticate, comprasController.limpiarQrsVencidos);

export default router;