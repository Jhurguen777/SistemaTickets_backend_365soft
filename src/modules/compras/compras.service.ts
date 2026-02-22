/**
 * SERVICIO DE COMPRAS - PAGOS QR
 * Sistema de Tickets 365Soft
 */

import { PrismaClient, EstadoPago, EstadoQr, EstadoAsiento } from '@prisma/client';
import bancoQrUtil from '../../shared/utils/banco-qr.util';
import {
  IniciarPagoRequest,
  IniciarPagoResponse,
  QrGeneradoResponse,
  VerificarPagoResponse,
  CompraConDetalles,
  PagoQrError,
  EstadoQr as EstadoQrEnum
} from './types';

const prisma = new PrismaClient();

class ComprasService {
  /**
   * Iniciar proceso de pago
   * Crea la compra y genera el QR del banco
   */
  async iniciarPago(
    usuarioId: string,
    params: IniciarPagoRequest
  ): Promise<IniciarPagoResponse> {
    try {
      // 1. Verificar que el asiento esté disponible
      const asiento = await prisma.asiento.findUnique({
        where: { id: params.asientoId },
        include: { evento: true }
      });

      if (!asiento) {
        throw new PagoQrError('Asiento no encontrado', 'ASIENTO_NOT_FOUND', 404);
      }

      if (asiento.estado !== EstadoAsiento.DISPONIBLE && asiento.estado !== EstadoAsiento.RESERVANDO) {
        throw new PagoQrError(
          `Asiento no disponible. Estado actual: ${asiento.estado}`,
          'ASIENTO_NOT_AVAILABLE',
          409
        );
      }

      // 2. Verificar que el evento esté activo
      if (asiento.evento.estado !== 'ACTIVO') {
        throw new PagoQrError(
          `El evento no está activo. Estado: ${asiento.evento.estado}`,
          'EVENTO_NOT_ACTIVE',
          400
        );
      }

      // 3. Calcular monto total (puede haber descuentos futuros)
      const montoTotal = asiento.evento.precio;

      // 4. Crear compra en estado PENDIENTE
      const compra = await prisma.compra.create({
        data: {
          usuarioId,
          eventoId: params.eventoId,
          asientoId: params.asientoId,
          monto: montoTotal,
          moneda: 'USD',
          metodoPago: 'QR',
          estadoPago: EstadoPago.PENDIENTE,
          qrCode: this.generarQrCodeEntrada(params.asientoId), // QR de entrada (diferente al de pago)
        }
      });

      // 5. Generar QR del banco
      const alias = bancoQrUtil.generarAliasUnico(compra.id);
      const fechaVencimiento = bancoQrUtil.calcularFechaVencimiento(24); // 24 horas
      const detalleGlosa = `Ticket Evento: ${asiento.evento.titulo} - Asiento: ${asiento.fila}${asiento.numero}`;

      const responseBanco = await bancoQrUtil.generarQrDinamico({
        alias,
        monto: montoTotal,
        detalleGlosa,
        fechaVencimiento
      });

      // 6. Verificar respuesta del banco
      if (!bancoQrUtil.validarRespuestaBanco(responseBanco)) {
        // Si falla, eliminar la compra creada
        await prisma.compra.delete({ where: { id: compra.id } });
        throw new PagoQrError(
          `Error generando QR con el banco: ${responseBanco.mensaje}`,
          'BANCO_QR_ERROR',
          500
        );
      }

      // 7. Crear registro en QrPagos
      const qrPago = await prisma.qrPagos.create({
        data: {
          alias,
          estado: EstadoQr.PENDIENTE,
          monto: montoTotal,
          moneda: 'BOB',
          compraId: compra.id,
          fechaVencimiento,
          imagenQr: responseBanco.objeto?.imagenQr,
          detalleGlosa
        }
      });

      // 8. Actualizar compra con referencia al QR
      await prisma.compra.update({
        where: { id: compra.id },
        data: {
          qrPagoId: qrPago.id,
          qrPagoAlias: qrPago.alias
        }
      });

      // 9. Actualizar asiento a RESERVANDO
      await prisma.asiento.update({
        where: { id: params.asientoId },
        data: {
          estado: EstadoAsiento.RESERVANDO,
          reservadoEn: new Date()
        }
      });

      return {
        success: true,
        message: 'Pago iniciado correctamente',
        compra: {
          id: compra.id,
          usuarioId: compra.usuarioId,
          eventoId: compra.eventoId,
          asientoId: compra.asientoId,
          monto: compra.monto,
          moneda: compra.moneda,
          estadoPago: compra.estadoPago,
          qrCode: compra.qrCode,
          createdAt: compra.createdAt
        }
      };
    } catch (error: any) {
      console.error('Error en iniciarPago:', error);
      if (error instanceof PagoQrError) {
        throw error;
      }
      throw new PagoQrError(
        `Error iniciando pago: ${error.message}`,
        'INICIAR_PAGO_ERROR',
        500
      );
    }
  }

  /**
   * Verificar estado de pago
   * Consulta al banco y actualiza el estado local
   */
  async verificarPago(qrId: string, usuarioId: string): Promise<VerificarPagoResponse> {
    try {
      // 1. Buscar el QR
      const qrPago = await prisma.qrPagos.findUnique({
        where: { id: qrId },
        include: { compra: true }
      });

      if (!qrPago) {
        throw new PagoQrError('QR no encontrado', 'QR_NOT_FOUND', 404);
      }

      // 2. Verificar que la compra pertenezca al usuario
      if (qrPago.compra?.usuarioId !== usuarioId) {
        throw new PagoQrError(
          'No tienes permiso para verificar este pago',
          'NOT_AUTHORIZED',
          403
        );
      }

      // 3. Consultar estado al banco
      const responseBanco = await bancoQrUtil.verificarEstadoQr(qrPago.alias);

      // 4. Actualizar estado local
      const estadoAnterior = qrPago.estado;
      const estadoNuevo = responseBanco.objeto.estadoActual;

      qrPago = await prisma.qrPagos.update({
        where: { id: qrId },
        data: {
          estado: estadoNuevo as EstadoQr,
          numeroOrden: responseBanco.objeto.numeroOrdenOriginante,
          nombreCliente: responseBanco.objeto.nombreCliente,
          documentoCliente: responseBanco.objeto.documentoCliente,
          cuentaCliente: responseBanco.objeto.cuentaCliente,
          fechaproceso: responseBanco.objeto.fechaproceso
            ? new Date(responseBanco.objeto.fechaproceso)
            : null
        }
      });

      // 5. Si el estado cambió a PAGADO, procesar el pago
      let pagoProcesado = false;
      if (estadoNuevo === 'PAGADO' && estadoAnterior !== 'PAGADO') {
        await this.procesarPagoQr(qrPago.id);
        pagoProcesado = true;
      }

      return {
        success: true,
        message: pagoProcesado
          ? '¡Pago detectado y procesado exitosamente!'
          : `Estado verificado: ${qrPago.estado}`,
        qr: {
          id: qrPago.id,
          alias: qrPago.alias,
          estado: qrPago.estado,
          monto: qrPago.monto,
          moneda: qrPago.moneda,
          fechaVencimiento: qrPago.fechaVencimiento,
          imagenQr: qrPago.imagenQr || undefined,
          detalleGlosa: qrPago.detalleGlosa || undefined
        },
        estadoTransaccion: responseBanco.objeto,
        pagoProcesado
      };
    } catch (error: any) {
      console.error('Error en verificarPago:', error);
      if (error instanceof PagoQrError) {
        throw error;
      }
      throw new PagoQrError(
        `Error verificando pago: ${error.message}`,
        'VERIFICAR_PAGO_ERROR',
        500
      );
    }
  }

  /**
   * Procesar pago cuando el QR es marcado como PAGADO
   * (llamado automáticamente por verificarPago o por webhook)
   */
  async procesarPagoQr(qrPagoId: string): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Obtener QR con compra
        const qrPago = await tx.qrPagos.findUnique({
          where: { id: qrPagoId },
          include: { compra: { include: { asiento: true } } }
        });

        if (!qrPago || !qrPago.compra) {
          throw new Error('QR o compra no encontrados');
        }

        // 2. Actualizar QR a PAGADO
        await tx.qrPagos.update({
          where: { id: qrPagoId },
          data: { estado: EstadoQr.PAGADO }
        });

        // 3. Actualizar compra a PAGADO
        await tx.compra.update({
          where: { id: qrPago.compraId },
          data: {
            estadoPago: EstadoPago.PAGADO,
            metodoPago: 'QR BANCO'
          }
        });

        // 4. Actualizar asiento a VENDIDO
        await tx.asiento.update({
          where: { id: qrPago.compra.asientoId },
          data: {
            estado: EstadoAsiento.VENDIDO,
            reservadoEn: null // Ya no es necesario
          }
        });

        console.log(`✅ Pago procesado: QR ${qrPago.alias} - Compra ${qrPago.compraId}`);
      });
    } catch (error: any) {
      console.error('Error en procesarPagoQr:', error);
      throw new PagoQrError(
        `Error procesando pago: ${error.message}`,
        'PROCESAR_PAGO_ERROR',
        500
      );
    }
  }

  /**
   * Manejar webhook del banco
   * El banco notifica cuando un QR es pagado
   */
  async manejarWebhook(payload: any): Promise<{ codigo: string; mensaje: string }> {
    try {
      const alias = payload.alias;

      // 1. Buscar QR por alias
      const qrPago = await prisma.qrPagos.findUnique({
        where: { alias }
      });

      if (!qrPago) {
        return {
          codigo: '1212',
          mensaje: 'Alias no encontrado en la base de datos'
        };
      }

      // 2. Si ya está pagado, devolver éxito
      if (qrPago.estado === EstadoQr.PAGADO) {
        return {
          codigo: '0000',
          mensaje: 'Registro Exitoso (ya estaba pagado)'
        };
      }

      // 3. Si está pendiente, procesar el pago
      if (qrPago.estado === EstadoQr.PENDIENTE) {
        // Procesar pago de forma asíncrona
        this.procesarPagoQr(qrPago.id).catch((error) => {
          console.error('Error procesando pago desde webhook:', error);
        });

        return {
          codigo: '0000',
          mensaje: 'Registro Exitoso'
        };
      }

      return {
        codigo: '1212',
        mensaje: 'Estado no válido para procesar'
      };
    } catch (error: any) {
      console.error('Error en manejarWebhook:', error);
      return {
        codigo: '1299',
        mensaje: 'Error interno del servidor'
      };
    }
  }

  /**
   * Obtener compras del usuario
   */
  async obtenerComprasUsuario(
    usuarioId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ compras: CompraConDetalles[]; total: number }> {
    const skip = (page - 1) * limit;

    const [compras, total] = await Promise.all([
      prisma.compra.findMany({
        where: { usuarioId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          evento: { select: { id: true, titulo: true, fecha: true, hora: true, ubicacion: true } },
          asiento: { select: { id: true, fila: true, numero: true } },
          qrPago: { select: { id: true, alias: true, estado: true, imagenQr: true } }
        }
      }),
      prisma.compra.count({ where: { usuarioId } })
    ]);

    return {
      compras: compras as CompraConDetalles[],
      total
    };
  }

  /**
   * Obtener detalle de compra
   */
  async obtenerCompraDetalle(compraId: string, usuarioId: string): Promise<CompraConDetalles | null> {
    const compra = await prisma.compra.findUnique({
      where: { id: compraId },
      include: {
        evento: { select: { id: true, titulo: true, fecha: true, hora: true, ubicacion: true } },
        asiento: { select: { id: true, fila: true, numero: true } },
        qrPago: { select: { id: true, alias: true, estado: true, imagenQr: true } }
      }
    });

    if (!compra || compra.usuarioId !== usuarioId) {
      return null;
    }

    return compra as CompraConDetalles;
  }

  /**
   * Cancelar QR (si el usuario no pagó)
   */
  async cancelarQr(qrId: string, usuarioId: string): Promise<void> {
    try {
      const qrPago = await prisma.qrPagos.findUnique({
        where: { id: qrId },
        include: { compra: true }
      });

      if (!qrPago) {
        throw new PagoQrError('QR no encontrado', 'QR_NOT_FOUND', 404);
      }

      if (qrPago.compra?.usuarioId !== usuarioId) {
        throw new PagoQrError('No autorizado', 'NOT_AUTHORIZED', 403);
      }

      if (qrPago.estado === EstadoQr.PAGADO) {
        throw new PagoQrError(
          'No se puede cancelar un QR que ya ha sido pagado',
          'QR_ALREADY_PAID',
          400
        );
      }

      await prisma.$transaction(async (tx) => {
        // Actualizar QR a CANCELADO
        await tx.qrPagos.update({
          where: { id: qrId },
          data: { estado: EstadoQr.CANCELADO }
        });

        // Actualizar compra a FALLIDO
        if (qrPago.compraId) {
          await tx.compra.update({
            where: { id: qrPago.compraId },
            data: { estadoPago: EstadoPago.FALLIDO }
          });
        }

        // Liberar asiento
        if (qrPago.compra?.asientoId) {
          await tx.asiento.update({
            where: { id: qrPago.compra.asientoId },
            data: {
              estado: EstadoAsiento.DISPONIBLE,
              reservadoEn: null
            }
          });
        }
      });
    } catch (error: any) {
      console.error('Error en cancelarQr:', error);
      if (error instanceof PagoQrError) {
        throw error;
      }
      throw new PagoQrError(
        `Error cancelando QR: ${error.message}`,
        'CANCELAR_QR_ERROR',
        500
      );
    }
  }

  /**
   * Generar QR code de entrada (diferente al QR de pago)
   * Formato: TICKET|compraId|asientoId|fila|numero
   */
  private generarQrCodeEntrada(asientoId: string): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `TICKET|${asientoId}|${timestamp}|${random}`;
  }

  /**
   * Limpieza de QRs vencidos (cron job)
   * Debería ejecutarse cada hora
   */
  async limpiarQrsVencidos(): Promise<void> {
    const ahora = new Date();

    const qrsVencidos = await prisma.qrPagos.findMany({
      where: {
        estado: EstadoQr.PENDIENTE,
        fechaVencimiento: { lt: ahora }
      },
      include: { compra: true }
    });

    for (const qr of qrsVencidos) {
      await prisma.$transaction(async (tx) => {
        // Actualizar QR a VENCIDO
        await tx.qrPagos.update({
          where: { id: qr.id },
          data: { estado: EstadoQr.VENCIDO }
        });

        // Actualizar compra a FALLIDO
        if (qr.compraId) {
          await tx.compra.update({
            where: { id: qr.compraId },
            data: { estadoPago: EstadoPago.FALLIDO }
          });
        }

        // Liberar asiento
        if (qr.compra?.asientoId) {
          await tx.asiento.update({
            where: { id: qr.compra.asientoId },
            data: {
              estado: EstadoAsiento.DISPONIBLE,
              reservadoEn: null
            }
          });
        }
      });

      console.log(`🗑️ QR vencido limpiado: ${qr.alias}`);
    }

    console.log(`✅ Limpieza completada: ${qrsVencidos.length} QRs vencidos`);
  }
}

export default new ComprasService();
