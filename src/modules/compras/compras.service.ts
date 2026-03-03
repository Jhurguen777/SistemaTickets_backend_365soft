/**
 * SERVICIO DE COMPRAS - PAGOS QR
 * Sistema de Tickets 365Soft
 */

import { EstadoPago, EstadoQr, EstadoAsiento } from '@prisma/client';
import prisma from '../../shared/config/database';
import bancoQrUtil from '../../shared/utils/banco-qr.util';
import {
  IniciarPagoRequest,
  IniciarPagoResponse,
  VerificarPagoResponse,
  CompraConDetalles,
  PagoQrError
} from './types';

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

      // 3. Verificar si ya existe una compra para este asiento
      const compraExistente = await prisma.compra.findUnique({
        where: { asientoId: params.asientoId },
        include: { qrPago: true }
      });

      // Si ya existe una compra, manejarla según su estado
      if (compraExistente) {
        // Si la compra está PAGADA o REEMBOLSADA, el asiento no está disponible
        if (compraExistente.estadoPago === EstadoPago.PAGADO ||
            compraExistente.estadoPago === EstadoPago.REEMBOLSADO) {
          throw new PagoQrError(
            `Este asiento ya ha sido comprado. Estado de pago: ${compraExistente.estadoPago}`,
            'ASIENTO_ALREADY_SOLD',
            409
          );
        }

        // Si la compra está PENDIENTE o FALLIDA, eliminarla y sus registros relacionados
        if (compraExistente.estadoPago === EstadoPago.PENDIENTE ||
            compraExistente.estadoPago === EstadoPago.FALLIDO) {
          console.log(`🗑️ Eliminando compra previa ${compraExistente.id} para asiento ${params.asientoId}`);

          // Eliminar QR pago si existe
          if (compraExistente.qrPagoId) {
            await prisma.qrPagos.delete({
              where: { id: compraExistente.qrPagoId }
            }).catch(() => {
              console.warn('⚠️  No se pudo eliminar QR pago, puede que ya no exista');
            });
          }

          // Eliminar compra existente
          await prisma.compra.delete({
            where: { id: compraExistente.id }
          });
        }
      }

      // 4. Calcular monto total (puede haber descuentos futuros)
      console.log('💰 params.monto recibido:', params.monto)
      console.log('💰 asiento.evento.precio:', asiento.evento.precio)
      const montoTotal = params.monto ?? asiento.evento.precio;

      // 5. Crear compra en estado PENDIENTE
      const compra = await prisma.compra.create({
        data: {
          usuarioId,
          eventoId:   params.eventoId,
          asientoId:  params.asientoId,
          monto:      montoTotal,
          moneda:     'USD',
          metodoPago: 'QR',
          estadoPago: EstadoPago.PENDIENTE,
          qrCode:     this.generarQrCodeEntrada(params.asientoId),
        }
      });

      // 6. Generar QR del banco (SIMULACIÓN - Próximamente se implementará API real)
      const alias = bancoQrUtil.generarAliasUnico(compra.id);
      const fechaVencimiento = bancoQrUtil.calcularFechaVencimiento(24);
      let detalleGlosa = `Ticket Evento: ${asiento.evento.titulo} - Asiento: Fila ${asiento.fila}${asiento.numero}`;

      if (params.asientosIds && params.asientosIds.length > 1) {
        const todosAsientos = await prisma.asiento.findMany({
          where: { id: { in: params.asientosIds } },
          select: { fila: true, numero: true }
        });
        const listaAsientos = todosAsientos.map(a => `${a.fila}${a.numero}`).join(', ');
        detalleGlosa = `Ticket Evento: ${asiento.evento.titulo} - Asientos: ${listaAsientos}`;
      }

      let responseBanco: any;
      try {
        responseBanco = await bancoQrUtil.generarQrDinamico({
          alias,
          monto: montoTotal,
          detalleGlosa,
          fechaVencimiento
        });
      } catch (bancoError) {
        console.warn('⚠️  API del banco no disponible - usando modo simulación:', bancoError);
        responseBanco = {
          codigo: '0000',
          mensaje: 'Simulación exitosa',
          objeto: {
            imagenQr: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=SIMULACION_${alias}`,
            alias: alias
          }
        };
      }

      // 7. Verificar respuesta del banco
      if (!bancoQrUtil.validarRespuestaBanco(responseBanco)) {
        await prisma.compra.delete({ where: { id: compra.id } });
        throw new PagoQrError(
          `Error generando QR con el banco: ${responseBanco.mensaje}`,
          'BANCO_QR_ERROR',
          500
        );
      }

      // 8. Crear registro en QrPagos
      const qrPago = await prisma.qrPagos.create({
        data: {
          alias,
          estado:          EstadoQr.PENDIENTE,
          monto:           montoTotal,
          moneda:          'BOB',
          compraId:        compra.id,
          fechaVencimiento,
          imagenQr:        responseBanco.objeto?.imagenQr,
          detalleGlosa
        }
      });

      // 9. Actualizar compra con referencia al QR
      await prisma.compra.update({
        where: { id: compra.id },
        data: {
          qrPagoId:    qrPago.id,
          qrPagoAlias: qrPago.alias
        }
      });

      // 10. Actualizar asiento a RESERVANDO
      await prisma.asiento.update({
        where: { id: params.asientoId },
        data: {
          estado:      EstadoAsiento.RESERVANDO,
          reservadoEn: new Date()
        }
      });

      return {
        success:  true,
        message:  'Pago iniciado correctamente',
        compra: {
          id:         compra.id,
          usuarioId:  compra.usuarioId,
          eventoId:   compra.eventoId,
          asientoId:  compra.asientoId,
          monto:      compra.monto,
          moneda:     compra.moneda,
          estadoPago: compra.estadoPago,
          qrCode:     compra.qrCode,
          qrPagoId:   qrPago.id,
          createdAt:  compra.createdAt
        },
        qrPago: {
          id:               qrPago.id,
          alias:            qrPago.alias,
          estado:           qrPago.estado,
          monto:            qrPago.monto,
          moneda:           qrPago.moneda,
          imagenQr:         qrPago.imagenQr,
          fechaVencimiento: qrPago.fechaVencimiento
        }
      };
    } catch (error: any) {
      console.error('Error en iniciarPago:', error);
      if (error instanceof PagoQrError) throw error;
      throw new PagoQrError(`Error iniciando pago: ${error.message}`, 'INICIAR_PAGO_ERROR', 500);
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

      if (qrPago.compra?.usuarioId !== usuarioId) {
        throw new PagoQrError('No tienes permiso para verificar este pago', 'NOT_AUTHORIZED', 403);
      }

      // 2. Consultar estado al banco
      let responseBanco: any;
      try {
        responseBanco = await bancoQrUtil.verificarEstadoQr(qrPago.alias);
      } catch (bancoError) {
        console.warn('⚠️  API del banco no disponible - usando modo simulación:', bancoError);
        responseBanco = {
          codigo: '0000',
          mensaje: 'Simulación - Estado verificado',
          objeto: {
            alias:        qrPago.alias,
            estadoActual: qrPago.estado,
            monto:        qrPago.monto,
            moneda:       qrPago.moneda
          }
        };
      }

      // 3. Actualizar estado local
      const estadoAnterior = qrPago.estado;
      const estadoNuevo    = responseBanco.objeto.estadoActual;

      const qrPagoActualizado = await prisma.qrPagos.update({
        where: { id: qrId },
        data: {
          estado:           estadoNuevo as EstadoQr,
          numeroOrden:      responseBanco.objeto.numeroOrdenOriginante,
          nombreCliente:    responseBanco.objeto.nombreCliente,
          documentoCliente: responseBanco.objeto.documentoCliente,
          cuentaCliente:    responseBanco.objeto.cuentaCliente,
          fechaproceso:     responseBanco.objeto.fechaproceso
            ? new Date(responseBanco.objeto.fechaproceso)
            : null
        }
      });

      // 4. Si el estado cambió a PAGADO, procesar el pago
      let pagoProcesado = false;
      if (estadoNuevo === 'PAGADO' && estadoAnterior !== 'PAGADO') {
        await this.procesarPagoQr(qrPagoActualizado.id);
        pagoProcesado = true;
      }

      return {
        success: true,
        message: pagoProcesado
          ? '¡Pago detectado y procesado exitosamente!'
          : `Estado verificado: ${qrPagoActualizado.estado}`,
        qr: {
          id:               qrPagoActualizado.id,
          alias:            qrPagoActualizado.alias,
          estado:           qrPagoActualizado.estado,
          monto:            qrPagoActualizado.monto,
          moneda:           qrPagoActualizado.moneda,
          fechaVencimiento: qrPagoActualizado.fechaVencimiento || undefined,
          imagenQr:         qrPagoActualizado.imagenQr         || undefined,
          detalleGlosa:     qrPagoActualizado.detalleGlosa     || ''
        },
        estadoTransaccion: responseBanco.objeto,
        pagoProcesado
      };
    } catch (error: any) {
      console.error('Error en verificarPago:', error);
      if (error instanceof PagoQrError) throw error;
      throw new PagoQrError(`Error verificando pago: ${error.message}`, 'VERIFICAR_PAGO_ERROR', 500);
    }
  }

  /**
   * Procesar pago cuando el QR es marcado como PAGADO
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
          data:  { estado: EstadoQr.PAGADO }
        });

        // 3. Actualizar compra a PAGADO
        if (qrPago.compraId) {
          await tx.compra.update({
            where: { id: qrPago.compraId },
            data:  { estadoPago: EstadoPago.PAGADO, metodoPago: 'QR BANCO' }
          });
        }

        // 4. Actualizar asiento a VENDIDO
        await tx.asiento.update({
          where: { id: qrPago.compra.asientoId },
          data:  { estado: EstadoAsiento.VENDIDO, reservadoEn: null }
        });

        console.log(`✅ Pago procesado: QR ${qrPago.alias} - Compra ${qrPago.compraId}`);
      });
    } catch (error: any) {
      console.error('Error en procesarPagoQr:', error);
      throw new PagoQrError(`Error procesando pago: ${error.message}`, 'PROCESAR_PAGO_ERROR', 500);
    }
  }

  /**
   * Manejar webhook del banco
   */
  async manejarWebhook(payload: any): Promise<{ codigo: string; mensaje: string }> {
    try {
      const alias = payload.alias;

      // 1. Buscar QR por alias
      const qrPago = await prisma.qrPagos.findUnique({
        where: { alias }
      });

      if (!qrPago) {
        return { codigo: '1212', mensaje: 'Alias no encontrado en la base de datos' };
      }

      if (qrPago.estado === EstadoQr.PAGADO) {
        return { codigo: '0000', mensaje: 'Registro Exitoso (ya estaba pagado)' };
      }

      if (qrPago.estado === EstadoQr.PENDIENTE) {
        this.procesarPagoQr(qrPago.id).catch((error) => {
          console.error('Error procesando pago desde webhook:', error);
        });
        return { codigo: '0000', mensaje: 'Registro Exitoso' };
      }

      return { codigo: '1212', mensaje: 'Estado no válido para procesar' };
    } catch (error: any) {
      console.error('Error en manejarWebhook:', error);
      return { codigo: '1299', mensaje: 'Error interno del servidor' };
    }
  }

  /**
   * Obtener compras del usuario
   */
  async obtenerComprasUsuario(
    usuarioId: string,
    page:  number = 1,
    limit: number = 10
  ): Promise<{ compras: CompraConDetalles[]; total: number }> {
    const skip = (page - 1) * limit;

    const [compras, total] = await Promise.all([
      prisma.compra.findMany({
        where:   { usuarioId },
        skip,
        take:    limit,
        orderBy: { createdAt: 'desc' },
        include: {
          evento:  { select: { id: true, titulo: true, fecha: true, hora: true, ubicacion: true } },
          asiento: { select: { id: true, fila: true, numero: true } },
          qrPago:  { select: { id: true, alias: true, estado: true, imagenQr: true } }
        }
      }),
      prisma.compra.count({ where: { usuarioId } })
    ]);

    return { compras: compras as CompraConDetalles[], total };
  }

  /**
   * Obtener detalle de compra
   */
  async obtenerCompraDetalle(compraId: string, usuarioId: string): Promise<CompraConDetalles | null> {
    const compra = await prisma.compra.findUnique({
      where:   { id: compraId },
      include: {
        evento:  { select: { id: true, titulo: true, fecha: true, hora: true, ubicacion: true } },
        asiento: { select: { id: true, fila: true, numero: true } },
        qrPago:  { select: { id: true, alias: true, estado: true, imagenQr: true } }
      }
    });

    if (!compra || compra.usuarioId !== usuarioId) return null;

    return compra as CompraConDetalles;
  }

  /**
   * Cancelar QR
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
        throw new PagoQrError('No se puede cancelar un QR que ya ha sido pagado', 'QR_ALREADY_PAID', 400);
      }

      await prisma.$transaction(async (tx) => {
        // Actualizar QR a CANCELADO
        await tx.qrPagos.update({
          where: { id: qrId },
          data:  { estado: EstadoQr.CANCELADO }
        });

        if (qrPago.compraId) {
          await tx.compra.update({
            where: { id: qrPago.compraId },
            data:  { estadoPago: EstadoPago.FALLIDO }
          });
        }

        if (qrPago.compra?.asientoId) {
          await tx.asiento.update({
            where: { id: qrPago.compra.asientoId },
            data:  { estado: EstadoAsiento.DISPONIBLE, reservadoEn: null }
          });
        }
      });
    } catch (error: any) {
      console.error('Error en cancelarQr:', error);
      if (error instanceof PagoQrError) throw error;
      throw new PagoQrError(`Error cancelando QR: ${error.message}`, 'CANCELAR_QR_ERROR', 500);
    }
  }

  /**
   * Generar QR code de entrada (diferente al QR de pago)
   */
  private generarQrCodeEntrada(asientoId: string): string {
    const timestamp = Date.now();
    const random    = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `TICKET|${asientoId}|${timestamp}|${random}`;
  }

  /**
   * Limpieza de QRs vencidos (cron job)
   */
  async limpiarQrsVencidos(): Promise<void> {
    const ahora = new Date();

    const qrsVencidos = await prisma.qrPagos.findMany({
      where: {
        estado:           EstadoQr.PENDIENTE,
        fechaVencimiento: { lt: ahora }
      },
      include: { compra: true }
    });

    for (const qr of qrsVencidos) {
      await prisma.$transaction(async (tx) => {
        // Actualizar QR a VENCIDO
        await tx.qrPagos.update({
          where: { id: qr.id },
          data:  { estado: EstadoQr.VENCIDO }
        });

        if (qr.compraId) {
          await tx.compra.update({
            where: { id: qr.compraId },
            data:  { estadoPago: EstadoPago.FALLIDO }
          });
        }

        if (qr.compra?.asientoId) {
          await tx.asiento.update({
            where: { id: qr.compra.asientoId },
            data:  { estado: EstadoAsiento.DISPONIBLE, reservadoEn: null }
          });
        }
      });

      console.log(`🗑️ QR vencido limpiado: ${qr.alias}`);
    }

    console.log(`✅ Limpieza completada: ${qrsVencidos.length} QRs vencidos`);
  }
}

export default new ComprasService();