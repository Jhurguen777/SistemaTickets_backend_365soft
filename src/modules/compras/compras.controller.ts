/**
 * CONTROLADOR DE COMPRAS - PAGOS QR
 * Sistema de Tickets 365Soft
 */

import { Request, Response } from 'express';
import comprasService from './compras.service';
import { PagoQrError, CrearConReservaRequest, CrearCompraGeneralRequest } from './types';
import prisma from '../../shared/config/database';

class ComprasController {
  /**
   * Crear compra con datos de asistentes y generar QR en un solo paso
   * POST /api/compras/crear-con-reserva
   */
  async crearConReserva(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        res.status(401).json({ success: false, message: 'No autenticado' });
        return;
      }

      const { eventoId, asistentes, medioPago } = req.body as CrearConReservaRequest;

      if (!eventoId || !asistentes || !Array.isArray(asistentes) || asistentes.length === 0) {
        res.status(400).json({ success: false, message: 'Faltan datos requeridos: eventoId y asistentes' });
        return;
      }

      for (const a of asistentes) {
        if (!a.asientoId || !a.nombre || !a.apellido) {
          res.status(400).json({ success: false, message: 'Cada asistente requiere asientoId, nombre y apellido' });
          return;
        }
      }

      const resultado = await comprasService.crearConReserva(usuarioId, { eventoId, asistentes, medioPago });
      res.status(201).json(resultado);
    } catch (error: any) {
      if (error instanceof PagoQrError) {
        res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
        return;
      }
      res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
    }
  }

  /**
   * Crear boletos generales (modo CANTIDAD) — sin asientos asignados
   * POST /api/compras/crear-general
   */
  async crearCompraGeneral(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        res.status(401).json({ success: false, message: 'No autenticado' });
        return;
      }

      const { eventoId, cantidad, asistentes, medioPago } = req.body as CrearCompraGeneralRequest;

      if (!eventoId || !cantidad || !asistentes || !Array.isArray(asistentes)) {
        res.status(400).json({ success: false, message: 'Faltan datos requeridos: eventoId, cantidad y asistentes' });
        return;
      }

      if (asistentes.length !== cantidad) {
        res.status(400).json({ success: false, message: 'La cantidad de asistentes debe coincidir con la cantidad de boletos' });
        return;
      }

      for (const a of asistentes) {
        if (!a.nombre || !a.apellido) {
          res.status(400).json({ success: false, message: 'Cada asistente requiere nombre y apellido' });
          return;
        }
      }

      const resultado = await comprasService.crearCompraGeneral(usuarioId, { eventoId, cantidad, asistentes, medioPago });
      res.status(201).json(resultado);
    } catch (error: any) {
      if (error instanceof PagoQrError) {
        res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
        return;
      }
      res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
    }
  }

  /**
   * Iniciar proceso de pago
   * POST /api/compras/iniciar-pago
   */
  async iniciarPago(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.user?.id;
      console.log('🔐 iniciarPago - Usuario autenticado:', {
        usuarioId,
        userEmail: req.user?.email,
        isAdmin: req.user?.isAdmin,
        tipoRol: req.user?.tipoRol
      });

      if (!usuarioId) {
        res.status(401).json({ success: false, message: 'No autenticado' });
        return;
      }

      const { asientoId, eventoId, monto, asientosIds } = req.body;

      if (!asientoId || !eventoId) {
        res.status(400).json({
          success: false,
          message: 'Faltan datos requeridos: asientoId y eventoId'
        });
        return;
      }

      const resultado = await comprasService.iniciarPago(usuarioId, { asientoId, eventoId, monto, asientosIds });

      res.status(201).json(resultado);
    } catch (error: any) {
      console.error('Error en iniciarPago controller:', error);

      if (error instanceof PagoQrError) {
        res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
        return;
      }

      res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
    }
  }

  /**
   * Verificar estado de pago
   * GET /api/compras/qr/verificar?id={qrPagoId}
   * Compatible con ambos: parámetro de ruta y query parameter
   */
  async verificarPago(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        res.status(401).json({ success: false, message: 'No autenticado' });
        return;
      }

      // Aceptar ambos: parámetro de ruta (qrId) y query parameter (id)
      const qrIdFromParam = (req.params as any).qrId || (req.params as any).id;
      const qrIdFromQuery = req.query.id as string;
      const finalQrId = qrIdFromQuery || qrIdFromParam;

      if (!finalQrId) {
        console.warn('⚠️ verificarPago sin QR ID:', {
          params: req.params,
          query: req.query
        });
        res.status(400).json({ success: false, message: 'QR ID es requerido' });
        return;
      }

      console.log('🔍 Verificando pago:', { qrId: finalQrId, usuarioId });
      const resultado = await comprasService.verificarPago(finalQrId, usuarioId);

      console.log('📤 Respuesta de verificación:', {
        success: resultado.success,
        estado: resultado.qr?.estado,
        pagoProcesado: resultado.pagoProcesado,
        message: resultado.message
      });

      res.status(200).json(resultado);
    } catch (error: any) {
      console.error('❌ Error en verificarPago controller:', error);

      if (error instanceof PagoQrError) {
        res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
        return;
      }

      res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
    }
  }

  /**
   * Obtener mis compras
   * GET /api/compras/mis-compras
   */
  async obtenerMisCompras(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        res.status(401).json({ success: false, message: 'No autenticado' });
        return;
      }

      const page  = parseInt(req.query.page  as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const resultado = await comprasService.obtenerComprasUsuario(usuarioId, page, limit);

      res.status(200).json({
        success: true,
        data: resultado.compras,
        pagination: {
          page,
          limit,
          total: resultado.total,
          totalPages: Math.ceil(resultado.total / limit)
        }
      });
    } catch (error: any) {
      console.error('Error en obtenerMisCompras controller:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
    }
  }

  /**
   * Obtener detalle de compra
   * GET /api/compras/:compraId
   */
  async obtenerCompraDetalle(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        res.status(401).json({ success: false, message: 'No autenticado' });
        return;
      }

      const { compraId } = req.params;

      if (!compraId) {
        res.status(400).json({ success: false, message: 'Compra ID es requerido' });
        return;
      }

      const compra = await comprasService.obtenerCompraDetalle(compraId, usuarioId);

      if (!compra) {
        res.status(404).json({ success: false, message: 'Compra no encontrada' });
        return;
      }

      res.status(200).json({ success: true, data: compra });
    } catch (error: any) {
      console.error('Error en obtenerCompraDetalle controller:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
    }
  }

  /**
   * Cancelar QR
   * POST /api/compras/cancelar-qr/:qrId
   */
  async cancelarQr(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        res.status(401).json({ success: false, message: 'No autenticado' });
        return;
      }

      const { qrId } = req.params;

      if (!qrId) {
        res.status(400).json({ success: false, message: 'QR ID es requerido' });
        return;
      }

      await comprasService.cancelarQr(qrId, usuarioId);

      res.status(200).json({ success: true, message: 'QR cancelado exitosamente' });
    } catch (error: any) {
      console.error('Error en cancelarQr controller:', error);

      if (error instanceof PagoQrError) {
        res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
        return;
      }

      res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
    }
  }

  /**
   * Webhook del banco
   * POST /api/compras/webhook-qr
   */
  async webhookBanco(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body;

      console.log('📬 Webhook recibido del banco:', payload);

      const resultado = await comprasService.manejarWebhook(payload);

      res.status(200).json({ codigo: resultado.codigo, mensaje: resultado.mensaje });
    } catch (error: any) {
      console.error('Error en webhookBanco controller:', error);
      // Siempre devolver 200 al banco para no reintentar
      res.status(200).json({ codigo: '1299', mensaje: 'Error procesando webhook' });
    }
  }

  /**
   * Obtener QR por ID (para mostrar en frontend)
   * GET /api/compras/qr/:qrId
   */
  async obtenerQr(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        res.status(401).json({ success: false, message: 'No autenticado' });
        return;
      }

      const { qrId } = req.params;

      // ✅ prisma.qrPagos — el modelo en schema.prisma se llama QrPagos
      const qrPago = await prisma.qrPagos.findUnique({
        where: { id: qrId },
        include: {
          compra: {
            select: {
              usuarioId: true,
              id: true,
              monto: true,
              createdAt: true
            }
          }
        }
      });

      if (!qrPago) {
        res.status(404).json({ success: false, message: 'QR no encontrado' });
        return;
      }

      if (qrPago.compra?.usuarioId !== usuarioId) {
        res.status(403).json({ success: false, message: 'No autorizado' });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          id:               qrPago.id,
          alias:            qrPago.alias,
          estado:           qrPago.estado,
          monto:            qrPago.monto,
          moneda:           qrPago.moneda,
          fechaVencimiento: qrPago.fechaVencimiento,
          imagenQr:         qrPago.imagenQr,
          detalleGlosa:     qrPago.detalleGlosa
        }
      });
    } catch (error: any) {
      console.error('Error en obtenerQr controller:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
    }
  }

  /**
   * Limpiar QRs vencidos (cron job)
   * POST /api/compras/limpiar-vencidos
   */
  async limpiarQrsVencidos(req: Request, res: Response): Promise<void> {
    try {
      const isAdmin    = req.user?.isAdmin === true;
      const isInternal = req.headers['x-internal-cron'] === 'true';

      if (!isAdmin && !isInternal) {
        res.status(403).json({ success: false, message: 'No autorizado' });
        return;
      }

      await comprasService.limpiarQrsVencidos();

      res.status(200).json({ success: true, message: 'Limpieza de QRs vencidos completada' });
    } catch (error: any) {
      console.error('Error en limpiarQrsVencidos controller:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
    }
  }
}

export default new ComprasController();