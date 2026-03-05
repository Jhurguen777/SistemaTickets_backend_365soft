// src/modules/compras/qr-pagos.service.ts

import prisma from '../../shared/config/database';
import { bancoQrUtil } from '../../shared/utils/banco-qr.util';
import {
  GenerarQrParams,
  VerificarEstadoResponse,
  QrInfo,
} from './types';
import comprasService from './compras.service';

class QrPagosService {

  /**
   * Genera un QR dinámico para pagar una compra
   */
  async generarQr(params: GenerarQrParams): Promise<QrInfo> {
    const { compraId, monto, nombreUsuario, nombreEvento } = params;

    // Generar alias único usando el util existente
    const alias = bancoQrUtil.generarAliasUnico(compraId);
    const detalleGlosa = `Ticket - ${nombreEvento} - ${nombreUsuario}`;
    const fechaVencimiento = bancoQrUtil.calcularFechaVencimiento(10); // 10 minutos de vencimiento

    // Llamar al banco
    const respuestaBanco = await bancoQrUtil.generarQrDinamico({
      alias,
      monto,
      detalleGlosa,
      fechaVencimiento,
    });

    if (!bancoQrUtil.validarRespuestaBanco(respuestaBanco)) {
      throw new Error(`Error al generar QR: ${respuestaBanco.mensaje}`);
    }

    // Guardar QR en BD
    const qrPago = await prisma.qrPagos.create({
      data: {
        alias,
        estado: 'PENDIENTE',
        monto,
        moneda: 'BOB',
        compraId,
        fechaVencimiento,
        detalleGlosa,
        imagenQr: respuestaBanco.objeto?.imagenQr ?? null,
      },
    });

    // Vincular QR a la compra
    await prisma.compra.update({
      where: { id: compraId },
      data: {
        qrPagoId: qrPago.id,
        qrPagoAlias: alias,
        metodoPago: 'QR',
        moneda: 'BOB',
      },
    });

    return {
    id: qrPago.id,
    alias: qrPago.alias,
    imagenQr: qrPago.imagenQr,
    monto: qrPago.monto,
    moneda: qrPago.moneda,
    estado: qrPago.estado,
    fechaVencimiento: qrPago.fechaVencimiento,
    detalleGlosa: qrPago.detalleGlosa ?? '',
    };
  }

  /**
   * Consulta el estado del QR al banco y actualiza la BD
   */
  async verificarEstado(qrPagoId: string): Promise<VerificarEstadoResponse> {
    console.log('[QR] Buscando QR con ID:', qrPagoId);

    const qrPago = await prisma.qrPagos.findUnique({
      where: { id: qrPagoId },
    });

    if (!qrPago) {
      console.warn('[QR] QR no encontrado en BD:', qrPagoId);
      throw new Error('QR no encontrado');
    }

    console.log('[QR] QR encontrado:', {
      id: qrPago.id,
      alias: qrPago.alias,
      estado: qrPago.estado,
      compraId: qrPago.compraId
    });

    // Consultar estado al banco
    console.log('🏦 Consultando estado al banco MC4 para alias:', qrPago.alias);
    const respuestaBanco = await bancoQrUtil.verificarEstadoQr(qrPago.alias);
    console.log('🏦 Respuesta del banco MC4:', {
      codigo: respuestaBanco.codigo,
      mensaje: respuestaBanco.mensaje,
      objeto: respuestaBanco.objeto
    });

    if (!bancoQrUtil.validarRespuestaBanco(respuestaBanco)) {
      throw new Error(`Error al verificar estado: ${respuestaBanco.mensaje}`);
    }

    const estadoActual = respuestaBanco.objeto.estadoActual;
    const estadoAnterior = qrPago.estado;

    console.log('🔄 Estado del QR:', {
      alias: qrPago.alias,
      estadoAnterior,
      estadoActual,
      cambioDetectado: estadoAnterior !== estadoActual,
      esPagado: estadoActual === 'PAGADO'
    });

    // Actualizar estado en BD
    await prisma.qrPagos.update({
      where: { id: qrPagoId },
      data: { estado: estadoActual as any },
    });

    // Si recién se pagó, procesar TODAS las compras pendientes del mismo usuario/evento
    if (estadoActual === 'PAGADO') {
      console.log('💰 Pago detectado, procesando todas las compras pendientes del usuario/evento con comprasService.procesarPagoQr()');
      // ✅ Usar comprasService.procesarPagoQr para procesar TODAS las compras pendientes del mismo usuario/evento
      await comprasService.procesarPagoQr(qrPago.id);
      return { estado: estadoActual, pagoProcesado: estadoAnterior !== 'PAGADO' };
    }

    return { estado: estadoActual, pagoProcesado: false };
  }

  /**
   * Procesa el pago: actualiza compra y asiento en una transacción
   */
  async procesarPago(qrPagoId: string, compraId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // 1. Marcar QR como PAGADO
      await tx.qrPagos.update({
        where: { id: qrPagoId },
        data: { estado: 'PAGADO' as any },
      });

      // 2. Marcar compra como PAGADA
      const compra = await tx.compra.update({
        where: { id: compraId },
        data: { estadoPago: 'PAGADO' },
      });

      // 3. Marcar asiento como VENDIDO
      if (compra.asientoId) {
        await tx.asiento.update({
          where: { id: compra.asientoId },
          data: { estado: 'VENDIDO' },
        });
      }
    });
  }

  /**
   * Procesa el webhook del banco (notificación automática de pago)
   */
  async procesarWebhook(payload: {
    alias: string;
    numeroOrdenOriginante?: string;
    nombreCliente?: string;
    documentoCliente?: string;
    cuentaCliente?: string;
    fechaproceso?: string;
  }): Promise<{ codigo: string; mensaje: string }> {

    const qrPago = await prisma.qrPagos.findUnique({
      where: { alias: payload.alias },
    });

    if (!qrPago) {
      return { codigo: '1212', mensaje: 'Alias no encontrado' };
    }

    // Actualizar datos del pago
    await prisma.qrPagos.update({
      where: { alias: payload.alias },
      data: {
        estado: 'PAGADO' as any,
        numeroOrden: payload.numeroOrdenOriginante ?? null,
        nombreCliente: payload.nombreCliente ?? null,
        documentoCliente: payload.documentoCliente ?? null,
        cuentaCliente: payload.cuentaCliente ?? null,
        fechaproceso: payload.fechaproceso ? new Date(payload.fechaproceso) : new Date(),
      },
    });

    // ✅ Procesar TODAS las compras pendientes del mismo usuario/evento usando comprasService.procesarPagoQr()
    console.log('💰 Webhook recibido, procesando todas las compras pendientes del usuario/evento con comprasService.procesarPagoQr()');
    await comprasService.procesarPagoQr(qrPago.id);

    return { codigo: '0000', mensaje: 'Registro Exitoso' };
  }

  /**
   * Cancela un QR que no ha sido pagado
   */
  async cancelarQr(qrPagoId: string): Promise<void> {
    const qrPago = await prisma.qrPagos.findUnique({ where: { id: qrPagoId } });

    if (!qrPago) throw new Error('QR no encontrado');
    if (qrPago.estado === 'PAGADO') throw new Error('No se puede cancelar un QR ya pagado');

    await prisma.qrPagos.update({
      where: { id: qrPagoId },
      data: { estado: 'CANCELADO' as any },
    });
  }
}

export const qrPagosService = new QrPagosService();
export default qrPagosService;
