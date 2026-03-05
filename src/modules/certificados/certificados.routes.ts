/**
 * RUTAS DE CERTIFICADOS
 * Sistema de Tickets 365Soft
 */

import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import certificadosController from './certificados.controller';

const router = Router();

// ============================================
// RUTAS DE PLANTILLAS
// ============================================

/**
 * @route   GET /api/certificados/plantillas
 * @desc    Obtener todas las plantillas de certificado
 * @access  Private (Admin)
 */
router.get('/plantillas', authenticate, certificadosController.obtenerPlantillas);

/**
 * @route   GET /api/certificados/plantillas/:id
 * @desc    Obtener una plantilla por ID
 * @access  Private (Admin)
 */
router.get('/plantillas/:id', authenticate, certificadosController.obtenerPlantilla);

/**
 * @route   POST /api/certificados/plantillas
 * @desc    Crear una nueva plantilla
 * @access  Private (Admin)
 */
router.post('/plantillas', authenticate, certificadosController.crearPlantilla);

/**
 * @route   PUT /api/certificados/plantillas/:id
 * @desc    Actualizar una plantilla
 * @access  Private (Admin)
 */
router.put('/plantillas/:id', authenticate, certificadosController.actualizarPlantilla);

/**
 * @route   DELETE /api/certificados/plantillas/:id
 * @desc    Eliminar una plantilla (soft delete)
 * @access  Private (Admin)
 */
router.delete('/plantillas/:id', authenticate, certificadosController.eliminarPlantilla);

// ============================================
// RUTAS DE CERTIFICADOS
// ============================================

/**
 * @route   POST /api/certificados/generar
 * @desc    Generar certificado individual
 * @access  Private (Admin)
 */
router.post('/generar', authenticate, certificadosController.generarCertificado);

/**
 * @route   POST /api/certificados/enviar
 * @desc    Enviar certificados por email (masivo)
 * @access  Private (Admin)
 */
router.post('/enviar', authenticate, certificadosController.enviarCertificados);

/**
 * @route   GET /api/certificados/eventos/:eventoId
 * @desc    Obtener certificados de un evento
 * @access  Private (Admin)
 */
router.get('/eventos/:eventoId', authenticate, certificadosController.obtenerCertificadosEvento);

/**
 * @route   GET /api/certificados/usuario/:usuarioId
 * @desc    Obtener certificados de un usuario
 * @access  Private
 */
router.get('/usuario/:usuarioId', authenticate, certificadosController.obtenerCertificadosUsuario);

/**
 * @route   GET /api/certificados/historial
 * @desc    Obtener historial de envíos
 * @access  Private (Admin)
 */
router.get('/historial', authenticate, certificadosController.obtenerHistorialEnvios);

// ============================================
// RUTAS PÚBLICAS (DESCARGAR)
// ============================================

/**
 * @route   GET /api/certificados/:compraId/descargar
 * @desc    Descargar certificado PDF
 * @access  Public
 */
router.get('/:compraId/descargar', certificadosController.descargarCertificado);

export default router;
