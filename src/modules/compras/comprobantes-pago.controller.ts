/**
 * CONTROLADOR DE COMPROBANTES DE PAGO (EFECTIVO)
 * Sistema de Tickets 365Soft
 */

import { Request, Response } from 'express';
import comprobantesPagoService from './comprobantes-pago.service';

class ComprobantesPagoController {
  /**
   * Subir comprobante de pago
   * POST /api/comprobantes-pago/subir
   */
  async subirComprobante(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        res.status(401).json({ success: false, message: 'No autenticado' });
        return;
      }

      const { compraId, imagenBase64, nombreArchivo, tipoArchivo } = req.body;

      if (!compraId || !imagenBase64) {
        res.status(400).json({
          success: false,
          message: 'Faltan datos requeridos: compraId e imagenBase64'
        });
        return;
      }

      const resultado = await comprobantesPagoService.subirComprobante(usuarioId, {
        compraId,
        imagenBase64,
        nombreArchivo,
        tipoArchivo
      });

      if (resultado.success) {
        res.status(201).json(resultado);
      } else {
        res.status(400).json(resultado);
      }
    } catch (error: any) {
      console.error('Error en subirComprobante controller:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
    }
  }

  /**
   * Listar comprobantes pendientes (Admin)
   * GET /api/admin/comprobantes-pago
   */
  async listarComprobantes(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.user?.id;
      const isAdmin = req.user?.isAdmin === true;

      if (!usuarioId) {
        res.status(401).json({ success: false, message: 'No autenticado' });
        return;
      }

      if (!isAdmin) {
        res.status(403).json({ success: false, message: 'No autorizado. Solo administradores.' });
        return;
      }

      const estado = req.query.estado as 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const resultado = await comprobantesPagoService.listarComprobantes({
        estado,
        page,
        limit
      });

      res.status(200).json({
        success: true,
        data: resultado.comprobantes,
        pagination: {
          page,
          limit,
          total: resultado.total,
          totalPages: Math.ceil(resultado.total / limit)
        }
      });
    } catch (error: any) {
      console.error('Error en listarComprobantes controller:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
    }
  }

  /**
   * Obtener detalle de comprobante (Admin)
   * GET /api/admin/comprobantes-pago/:comprobanteId
   */
  async obtenerComprobante(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.user?.id;
      const isAdmin = req.user?.isAdmin === true;

      if (!usuarioId) {
        res.status(401).json({ success: false, message: 'No autenticado' });
        return;
      }

      if (!isAdmin) {
        res.status(403).json({ success: false, message: 'No autorizado. Solo administradores.' });
        return;
      }

      const { comprobanteId } = req.params;

      if (!comprobanteId) {
        res.status(400).json({ success: false, message: 'Comprobante ID es requerido' });
        return;
      }

      const comprobante = await comprobantesPagoService.obtenerComprobante(comprobanteId);

      if (!comprobante) {
        res.status(404).json({ success: false, message: 'Comprobante no encontrado' });
        return;
      }

      res.status(200).json({ success: true, data: comprobante });
    } catch (error: any) {
      console.error('Error en obtenerComprobante controller:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
    }
  }

  /**
   * Aprobar comprobante (Admin)
   * POST /api/admin/comprobantes-pago/:comprobanteId/aprobar
   */
  async aprobarComprobante(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.user?.id;
      const isAdmin = req.user?.isAdmin === true;

      if (!usuarioId) {
        res.status(401).json({ success: false, message: 'No autenticado' });
        return;
      }

      if (!isAdmin) {
        res.status(403).json({ success: false, message: 'No autorizado. Solo administradores.' });
        return;
      }

      const { comprobanteId } = req.params;

      if (!comprobanteId) {
        res.status(400).json({ success: false, message: 'Comprobante ID es requerido' });
        return;
      }

      const resultado = await comprobantesPagoService.aprobarComprobante(comprobanteId, usuarioId);

      if (resultado.success) {
        res.status(200).json(resultado);
      } else {
        res.status(400).json(resultado);
      }
    } catch (error: any) {
      console.error('Error en aprobarComprobante controller:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
    }
  }

  /**
   * Rechazar comprobante (Admin)
   * POST /api/admin/comprobantes-pago/:comprobanteId/rechazar
   */
  async rechazarComprobante(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.user?.id;
      const isAdmin = req.user?.isAdmin === true;

      if (!usuarioId) {
        res.status(401).json({ success: false, message: 'No autenticado' });
        return;
      }

      if (!isAdmin) {
        res.status(403).json({ success: false, message: 'No autorizado. Solo administradores.' });
        return;
      }

      const { comprobanteId } = req.params;
      const { mensajeRechazo } = req.body;

      if (!comprobanteId) {
        res.status(400).json({ success: false, message: 'Comprobante ID es requerido' });
        return;
      }

      const resultado = await comprobantesPagoService.rechazarComprobante(
        comprobanteId,
        usuarioId,
        mensajeRechazo
      );

      if (resultado.success) {
        res.status(200).json(resultado);
      } else {
        res.status(400).json(resultado);
      }
    } catch (error: any) {
      console.error('Error en rechazarComprobante controller:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
    }
  }
}

export default new ComprobantesPagoController();
