// src/modules/compras/qr-pagos.controller.ts
import { Request, Response } from 'express';
import prisma from '../../shared/config/database';
import qrPagosService from './qr-pagos.service';
import comprasService from './compras.service';

/**
 * POST /api/compras/qr/generar
 * Body: { compraId: string, monto: number }
 */
export async function generarQr(req: Request, res: Response): Promise<void> {
  try {
    const { compraId, monto } = req.body;
    const usuarioId = (req as any).user?.id;

    if (!compraId || !monto) {
      res.status(400).json({ success: false, message: 'compraId y monto son requeridos' });
      return;
    }

    // Verificar que la compra pertenezca al usuario autenticado
    const compra = await prisma.compra.findFirst({
      where: { id: compraId, usuarioId },
      include: {
        usuario: true,
        evento: true,
      },
    });

    if (!compra) {
      res.status(404).json({ success: false, message: 'Compra no encontrada' });
      return;
    }

    if (compra.estadoPago === 'PAGADO') {
      res.status(400).json({ success: false, message: 'Esta compra ya fue pagada' });
      return;
    }

    const nombreUsuario = `${compra.usuario.nombre} ${compra.usuario.apellido ?? ''}`.trim();

    const resultado = await qrPagosService.generarQr({
      compraId,
      monto: parseFloat(monto),
      nombreUsuario,
      nombreEvento: compra.evento.titulo,
    });

    res.status(200).json({
      success: true,
      message: 'QR generado exitosamente',
      data: resultado,
    });
  } catch (error: any) {
    console.error('[QR] Error al generar:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/compras/qr/estado/:qrPagoId
 * GET /api/compras/qr/verificar?id={qrPagoId}
 * Polling desde el frontend para verificar si ya fue pagado
 */
export async function verificarEstado(req: Request, res: Response): Promise<void> {
  try {
    // Aceptar ambos: parámetro de ruta y query parameter
    const qrIdFromParam = (req.params as any).qrPagoId;
    const qrIdFromQuery = req.query.id as string;
    const finalQrId = qrIdFromQuery || qrIdFromParam;

    if (!finalQrId) {
      res.status(400).json({ success: false, message: 'QR ID es requerido' });
      return;
    }

    const resultado = await qrPagosService.verificarEstado(finalQrId);

    res.status(200).json({
      success: true,
      estado: resultado.estado,
      pagoProcesado: resultado.pagoProcesado,
      message: resultado.pagoProcesado
        ? '¡Pago confirmado exitosamente!'
        : `Estado actual: ${resultado.estado}`,
    });
  } catch (error: any) {
    console.error('[QR] Error al verificar estado:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /api/compras/webhook/banco
 * ⚠️ RUTA PÚBLICA - el banco MC4 llama aquí automáticamente cuando alguien paga
 * NO agregar middleware de autenticación JWT a esta ruta
 */
export async function handleWebhook(req: Request, res: Response): Promise<void> {
  try {
    const payload = req.body;

    if (!payload.alias) {
      res.status(200).json({ codigo: '1212', mensaje: 'Alias requerido' });
      return;
    }

    const resultado = await comprasService.manejarWebhook(payload);
    res.status(200).json(resultado);
  } catch (error: any) {
    console.error('[QR] Error en webhook:', error.message);
    // Siempre responder 200 al banco aunque haya error interno
    res.status(200).json({ codigo: '1212', mensaje: 'Error interno' });
  }
}

/**
 * DELETE /api/compras/qr/:qrPagoId
 * Cancelar un QR pendiente
 */
export async function cancelarQr(req: Request, res: Response): Promise<void> {
  try {
    const { qrPagoId } = req.params;
    const usuarioId = (req as any).user?.id;

    if (!usuarioId) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    await qrPagosService.cancelarQr(qrPagoId);

    res.status(200).json({ success: true, message: 'QR cancelado exitosamente' });
  } catch (error: any) {
    console.error('[QR] Error al cancelar:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
}
