/**
 * CONTROLADOR DE COMPRAS - PAGOS QR
 * Sistema de Tickets 365Soft
 */

import { Request, Response } from 'express';
import comprasService from './compras.service';
import { PagoQrError } from './types';

class ComprasController {
  /**
   * Iniciar proceso de pago
   * POST /api/compras/iniciar-pago
   */
  async iniciarPago(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        res.status(401).json({
          success: false,
          message: 'No autenticado'
        });
        return;
      }

      const { asientoId, eventoId } = req.body;

      if (!asientoId || !eventoId) {
        res.status(400).json({
          success: false,
          message: 'Faltan datos requeridos: asientoId y eventoId'
        });
        return;
      }

      const resultado = await comprasService.iniciarPago(usuarioId, {
        asientoId,
        eventoId
      });

      res.status(201).json(resultado);
    } catch (error: any) {
      console.error('Error en iniciarPago controller:', error);

      if (error instanceof PagoQrError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  /**
   * Verificar estado de pago
   * GET /api/compras/verificar-pago/:qrId
   */
  async verificarPago(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        res.status(401).json({
          success: false,
          message: 'No autenticado'
        });
        return;
      }

      const { qrId } = req.params;

      if (!qrId) {
        res.status(400).json({
          success: false,
          message: 'QR ID es requerido'
        });
        return;
      }

      const resultado = await comprasService.verificarPago(qrId, usuarioId);

      res.status(200).json(resultado);
    } catch (error: any) {
      console.error('Error en verificarPago controller:', error);

      if (error instanceof PagoQrError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
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
        res.status(401).json({
          success: false,
          message: 'No autenticado'
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const resultado = await comprasService.obtenerComprasUsuario(
        usuarioId,
        page,
        limit
      );

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

      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
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
        res.status(401).json({
          success: false,
          message: 'No autenticado'
        });
        return;
      }

      const { compraId } = req.params;

      if (!compraId) {
        res.status(400).json({
          success: false,
          message: 'Compra ID es requerido'
        });
        return;
      }

      const compra = await comprasService.obtenerCompraDetalle(compraId, usuarioId);

      if (!compra) {
        res.status(404).json({
          success: false,
          message: 'Compra no encontrada'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: compra
      });
    } catch (error: any) {
      console.error('Error en obtenerCompraDetalle controller:', error);

      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
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
        res.status(401).json({
          success: false,
          message: 'No autenticado'
        });
        return;
      }

      const { qrId } = req.params;

      if (!qrId) {
        res.status(400).json({
          success: false,
          message: 'QR ID es requerido'
        });
        return;
      }

      await comprasService.cancelarQr(qrId, usuarioId);

      res.status(200).json({
        success: true,
        message: 'QR cancelado exitosamente'
      });
    } catch (error: any) {
      console.error('Error en cancelarQr controller:', error);

      if (error instanceof PagoQrError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
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

      // El banco espera una respuesta específica
      res.status(200).json({
        codigo: resultado.codigo,
        mensaje: resultado.mensaje
      });
    } catch (error: any) {
      console.error('Error en webhookBanco controller:', error);

      // Siempre devolver 200 al banco para no reintentar
      res.status(200).json({
        codigo: '1299',
        mensaje: 'Error procesando webhook'
      });
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
        res.status(401).json({
          success: false,
          message: 'No autenticado'
        });
        return;
      }

      const { qrId } = req.params;

      // Buscar QR
      const prisma = (await import('@prisma/client')).PrismaClient;
      const prismaClient = new prisma();

      const qrPago = await prismaClient.qrPagos.findUnique({
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
        res.status(404).json({
          success: false,
          message: 'QR no encontrado'
        });
        return;
      }

      // Verificar que pertenezca al usuario
      if (qrPago.compra?.usuarioId !== usuarioId) {
        res.status(403).json({
          success: false,
          message: 'No autorizado'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          id: qrPago.id,
          alias: qrPago.alias,
          estado: qrPago.estado,
          monto: qrPago.monto,
          moneda: qrPago.moneda,
          fechaVencimiento: qrPago.fechaVencimiento,
          imagenQr: qrPago.imagenQr,
          detalleGlosa: qrPago.detalleGlosa
        }
      });
    } catch (error: any) {
      console.error('Error en obtenerQr controller:', error);

      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  /**
   * Limpiar QRs vencidos (cron job)
   * POST /api/compras/limpiar-vencidos
   */
  async limpiarQrsVencidos(req: Request, res: Response): Promise<void> {
    try {
      // Verificar que sea admin o un cron job interno
      const isAdmin = req.user?.rol === 'ADMIN';
      const isInternal = req.headers['x-internal-cron'] === 'true';

      if (!isAdmin && !isInternal) {
        res.status(403).json({
          success: false,
          message: 'No autorizado'
        });
        return;
      }

      await comprasService.limpiarQrsVencidos();

      res.status(200).json({
        success: true,
        message: 'Limpieza de QRs vencidos completada'
      });
    } catch (error: any) {
      console.error('Error en limpiarQrsVencidos controller:', error);

      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }
}

export default new ComprasController();
