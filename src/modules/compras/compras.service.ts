/**
 * SERVICIO DE COMPRAS - PAGOS QR
 * Sistema de Tickets 365Soft
 */

import prisma from '../../shared/config/database';
import bancoQrUtil from '../../shared/utils/banco-qr.util';
import { extenderLocksParaPago } from '../asientos/asientos.service';
import {
  IniciarPagoRequest,
  IniciarPagoResponse,
  VerificarPagoResponse,
  CompraConDetalles,
  PagoQrError
} from './types';

// Estado constants as strings
const ESTADO_PAGO_PENDIENTE = 'PENDIENTE';
const ESTADO_PAGO_FALLIDO = 'FALLIDO';
const ESTADO_QR_PENDIENTE = 'PENDIENTE';
const ESTADO_QR_PAGADO = 'PAGADO';
const ESTADO_QR_CANCELADO = 'CANCELADO';
const ESTADO_QR_VENCIDO = 'VENCIDO';
const ESTADO_ASIENTO_DISPONIBLE = 'DISPONIBLE';
const ESTADO_ASIENTO_RESERVANDO = 'RESERVANDO';

class ComprasService {
  /**
   * Iniciar proceso de pago
   * Soporta multiples asientos con extension de locks
   */
  async iniciarPago(
    usuarioId: string,
    params: IniciarPagoRequest
  ): Promise<IniciarPagoResponse> {
    try {
      const asientosIds = params.asientosIds || [params.asientoId];
      const eventoId = params.eventoId;
      const userId = usuarioId; // Use the correct parameter name

      // 1. Extender locks de los asientos para proceso de pago (10 min)
      try {
        const locksExtendidos = await extenderLocksParaPago({
          asientosIds,
          eventoId,
          userId
        });

        if (!locksExtendidos) {
          throw new PagoQrError(
            'No se pudieron extender los locks. Los asientos pueden haber expirado.',
            'LOCKS_EXPIRED',
            409
          );
        }
      } catch (err) {
        console.warn('⚠️  No se pudieron extender locks, Redis puede no estar disponible:', err);
      }

      // 2. Verificar que los asientos existan y esten disponibles
      const asientos = await prisma.asiento.findMany({
        where: {
          id: { in: asientosIds },
          eventoId
        },
        include: { evento: true }
      });

      if (asientos.length === 0 || asientos.length !== asientosIds.length) {
        throw new PagoQrError('Algunos asientos no existen', 'ASIENTOS_NOT_FOUND', 404);
      }

      // 3. Verificar que el evento este activo
      if (asientos[0].evento.estado !== 'ACTIVO') {
        throw new PagoQrError(
          `El evento no esta activo. Estado: ${asientos[0].evento.estado}`,
          'EVENTO_NOT_ACTIVE',
          400
        );
      }

      // 4. Verificar si ya existen compras para estos asientos
      const comprasExistentes = await prisma.compra.findMany({
        where: {
          asientoId: { in: asientosIds }
        },
        include: { qrPago: true }
      });

      // 5. Eliminar compras previas PENDIENTE o FALLIDAS y sus QRs
      if (comprasExistentes.length > 0) {
        const comprasAEliminar = comprasExistentes.filter(c =>
          c.estadoPago === ESTADO_PAGO_PENDIENTE || c.estadoPago === ESTADO_PAGO_FALLIDO
        );

        if (comprasAEliminar.length > 0) {
          console.log(`🗑️  Eliminando ${comprasAEliminar.length} compras previas...`);

          for (const compra of comprasAEliminar) {
            // Eliminar QR asociado
            if (compra.qrPagoId) {
              await prisma.qrPagos.delete({
                where: { id: compra.qrPagoId }
              }).catch(() => {
                console.warn('⚠️  No se pudo eliminar QR pago');
              });
            }
            // Liberar el asiento asociado
            if (compra.asientoId) {
              await prisma.asiento.update({
                where: { id: compra.asientoId },
                data: { estado: ESTADO_ASIENTO_DISPONIBLE, reservadoEn: null }
              }).catch(() => {
                console.warn('⚠️  No se pudo liberar el asiento');
              });
            }
            // Eliminar la compra
            await prisma.compra.delete({
              where: { id: compra.id }
            });
            console.log(`✅ Asiento liberado: ${compra.asientoId} (compra previa eliminada)`);
          }
        }
      }

      // 6. Verificar disponibilidad final de los asientos
      const noDisponibles = asientos.filter(a =>
        a.estado !== ESTADO_ASIENTO_DISPONIBLE && a.estado !== ESTADO_ASIENTO_RESERVANDO
      );

      if (noDisponibles.length > 0) {
        const ids = noDisponibles.map(a => `${a.fila}${a.numero}`).join(', ');
        throw new PagoQrError(
          `Los siguientes asientos no estan disponibles: ${ids}`,
          'ASIENTOS_NOT_AVAILABLE',
          409
        );
      }

      // 7. Calcular monto total
      const precioEvento = asientos[0].evento.precio;
      const montoTotal = params.monto ?? (precioEvento * asientosIds.length);

      // 8. Crear compras en estado PENDIENTE (transaccional)
      const compras = await prisma.$transaction(async (tx) => {
        const nuevasCompras = [];

        for (let i = 0; i < asientosIds.length; i++) {
          const asiento = asientos[i];
          const compra = await tx.compra.create({
            data: {
              usuarioId,
              eventoId,
              asientoId: asiento.id,
              monto: precioEvento,
              moneda: 'USD',
              metodoPago: 'QR',
              estadoPago: ESTADO_PAGO_PENDIENTE,
              qrCode: this.generarQrCodeEntrada(asiento.id)
            }
          });
          nuevasCompras.push(compra);
        }

        return nuevasCompras;
      });

      // 9. Generar QR del banco
      const alias = bancoQrUtil.generarAliasUnico(compras[0].id);
      const fechaVencimiento = bancoQrUtil.calcularFechaVencimiento(10); // 10 minutos de vencimiento

      const listaAsientos = asientos.map(a => `${a.fila}${a.numero}`).join(', ');
      const detalleGlosa = `Ticket Evento: ${asientos[0].evento.titulo} - Asientos: ${listaAsientos}`;

      let responseBanco: any;
      try {
        responseBanco = await bancoQrUtil.generarQrDinamico({
          alias,
          monto: montoTotal,
          detalleGlosa,
          fechaVencimiento
        });
      } catch (bancoError) {
        console.warn('⚠️  API del banco no disponible - usando modo simulacion:', bancoError);
        responseBanco = {
          codigo: '0000',
          mensaje: 'Simulacion exitosa',
          objeto: {
            imagenQr: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=SIMULACION_${alias}`,
            alias: alias
          }
        };
      }

      // 10. Verificar respuesta del banco
      if (!bancoQrUtil.validarRespuestaBanco(responseBanco)) {
        // Rollback: eliminar compras creadas
        await prisma.compra.deleteMany({
          where: { id: { in: compras.map(c => c.id) } }
        });
        throw new PagoQrError(
          `Error generando QR con el banco: ${responseBanco.mensaje}`,
          'BANCO_QR_ERROR',
          500
        );
      }

      // 11. Eliminar TODOS los QRs pagos asociados a estas compras (evitar duplicados)
      const compraIds = compras.map(c => c.id);
      const existingQrPagos = await prisma.qrPagos.findMany({
        where: {
          compraId: { in: compraIds }
        }
      });

      if (existingQrPagos.length > 0) {
        console.log(`🗑️  Eliminando ${existingQrPagos.length} QRs pagos existentes para evitar duplicados`);
        await prisma.qrPagos.deleteMany({
          where: {
            id: { in: existingQrPagos.map(qr => qr.id) }
          }
        });
      }

      // 12. Crear registro en QrPagos (para la primera compra principal)
      const qrPago = await prisma.qrPagos.create({
        data: {
          alias,
          estado: ESTADO_QR_PENDIENTE,
          monto: montoTotal,
          moneda: 'BOB',
          compraId: compras[0].id,
          fechaVencimiento,
          imagenQr: responseBanco.objeto?.imagenQr,
          detalleGlosa
        }
      });

      console.log('💾 QR Pago creado en BD:', {
        id: qrPago.id,
        alias: qrPago.alias,
        imagenQrLength: qrPago.imagenQr?.length,
        imagenQrPreview: qrPago.imagenQr?.substring(0, 50) + '...'
      });

      // 13. Actualizar SOLO la primera compra con referencia al QR (evitar restricción de unicidad)
      // Las compras adicionales se procesarán cuando se confirme el pago en procesarPagoQr
      console.log(`🔗 Vinculando QR ${qrPago.id} a la compra principal ${compras[0].id}`);
      await prisma.compra.update({
        where: { id: compras[0].id },
        data: {
          qrPagoId: qrPago.id,
          qrPagoAlias: qrPago.alias
        }
      });

      console.log(`✅ ${compras.length} compras iniciadas para usuario ${usuarioId} (QR vinculado a primera compra)`);

      console.log(`✅ ${compras.length} compras iniciadas para usuario ${usuarioId}`);

      console.log('📤 QR Pago creado:', {
        qrPagoId: qrPago.id,
        qrPagoAlias: qrPago.alias,
        imagenQrLength: qrPago.imagenQr?.length,
        imagenQrPreview: qrPago.imagenQr?.substring(0, 50) + '...'
      });

      return {
        success: true,
        message: 'Pago iniciado correctamente',
        compras: compras.map(c => ({
          id: c.id,
          usuarioId: c.usuarioId,
          eventoId: c.eventoId,
          asientoId: c.asientoId,
          monto: c.monto,
          moneda: c.moneda,
          estadoPago: c.estadoPago,
          qrCode: c.qrCode,
          qrPagoId: qrPago.id,
          createdAt: c.createdAt
        })),
        qrPago: {
          id: qrPago.id,
          alias: qrPago.alias,
          estado: qrPago.estado,
          monto: montoTotal,
          moneda: qrPago.moneda,
          imagenQr: qrPago.imagenQr,
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
      console.log('🔍 Buscando QR en BD:', {
        qrId,
        qrIdLength: qrId.length,
        usuarioId
      });

      // 1. Buscar el QR
      const qrPago = await prisma.qrPagos.findUnique({
        where: { id: qrId }
      });

      if (!qrPago) {
        // Intentar listar todos los QRs para depuración
        const allQrPagos = await prisma.qrPagos.findMany({
          select: { id: true, alias: true, estado: true, compraId: true }
        });
        console.error('❌ QR no encontrado. QRs existentes en BD:', JSON.stringify(allQrPagos, null, 2));
        throw new PagoQrError('QR no encontrado', 'QR_NOT_FOUND', 404);
      }

      console.log('✅ QR encontrado:', {
        qrId: qrPago.id,
        alias: qrPago.alias,
        estado: qrPago.estado,
        compraId: qrPago.compraId
      });

      // 2. Verificar que el QR pertenezca al usuario (buscando por compraId)
      if (qrPago.compraId) {
        const compra = await prisma.compra.findUnique({
          where: { id: qrPago.compraId }
        });

        if (!compra) {
          throw new PagoQrError('Compra asociada no encontrada', 'COMPRA_NOT_FOUND', 404);
        }

        if (compra.usuarioId !== usuarioId) {
          throw new PagoQrError('No tienes permiso para verificar este pago', 'NOT_AUTHORIZED', 403);
        }
      }

      // 2. Consultar estado al banco
      let responseBanco: any;
      try {
        console.log('🏦 Consultando estado al banco MC4 para alias:', qrPago.alias);
        responseBanco = await bancoQrUtil.verificarEstadoQr(qrPago.alias);
        console.log('🏦 Respuesta del banco MC4:', JSON.stringify(responseBanco, null, 2));
      } catch (bancoError) {
        console.warn('⚠️  API del banco no disponible - usando modo simulacion:', bancoError);
        responseBanco = {
          codigo: '0000',
          mensaje: 'Simulacion - Estado verificado',
          objeto: {
            alias: qrPago.alias,
            estadoActual: qrPago.estado,
            monto: qrPago.monto,
            moneda: qrPago.moneda
          }
        };
      }

      // 3. Actualizar estado local
      const estadoAnterior = qrPago.estado;
      const estadoNuevo = responseBanco.objeto.estadoActual;

      console.log('🔄 Estado del QR:', {
        alias: qrPago.alias,
        estadoAnterior,
        estadoNuevo,
        cambioDetectado: estadoAnterior !== estadoNuevo
      });

      const qrPagoActualizado = await prisma.qrPagos.update({
        where: { id: qrId },
        data: {
          estado: estadoNuevo as any,
          numeroOrden: responseBanco.objeto.numeroOrdenOriginante,
          nombreCliente: responseBanco.objeto.nombreCliente,
          documentoCliente: responseBanco.objeto.documentoCliente,
          cuentaCliente: responseBanco.objeto.cuentaCliente,
          fechaproceso: responseBanco.objeto.fechaproceso
            ? new Date(responseBanco.objeto.fechaproceso)
            : null
        }
      });

      // 4. Si el estado cambio a PAGADO, procesar el pago
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
          id: qrPagoActualizado.id,
          alias: qrPagoActualizado.alias,
          estado: qrPagoActualizado.estado,
          monto: qrPagoActualizado.monto,
          moneda: qrPagoActualizado.moneda,
          fechaVencimiento: qrPagoActualizado.fechaVencimiento || undefined,
          imagenQr: qrPagoActualizado.imagenQr || undefined,
          detalleGlosa: qrPagoActualizado.detalleGlosa || ''
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
   * Actualiza TODAS las compras relacionadas del mismo usuario/evento
   */
  async procesarPagoQr(qrPagoId: string, bancoPayload?: any): Promise<void> {
    try {
      console.log('💰 Procesando pago:', {
        qrPagoId,
        monto: bancoPayload?.monto,
        numeroOrden: bancoPayload?.numeroOrdenOriginante,
        nombreCliente: bancoPayload?.nombreCliente,
        documentoCliente: bancoPayload?.documentoCliente,
        timestamp: new Date().toISOString()
      });

      await prisma.$transaction(async (tx) => {
        // 1. Obtener QR con compra principal
        const qrPago = await tx.qrPagos.findUnique({
          where: { id: qrPagoId },
          include: { compra: true }
        });

        if (!qrPago || !qrPago.compra) {
          throw new Error('QR o compra no encontrados');
        }

        // 2. Buscar TODAS las compras PENDIENTES del mismo usuario/evento
        const comprasPendientes = await tx.compra.findMany({
          where: {
            usuarioId: qrPago.compra.usuarioId,
            eventoId: qrPago.compra.eventoId,
            estadoPago: ESTADO_PAGO_PENDIENTE,
            createdAt: {
              // Solo compras creadas en los últimos 15 minutos (para evitar actualizar compras antiguas)
              gte: new Date(Date.now() - 15 * 60 * 1000)
            }
          },
          include: { asiento: true }
        });

        console.log(`🔍 Encontradas ${comprasPendientes.length} compras pendientes para procesar`);

        if (comprasPendientes.length === 0) {
          console.warn('⚠️ No se encontraron compras pendientes para procesar');
          return;
        }

        // 3. Actualizar QR a PAGADO (con datos del banco si están disponibles)
        await tx.qrPagos.update({
          where: { id: qrPagoId },
          data: {
            estado: ESTADO_QR_PAGADO,
            ...(bancoPayload?.numeroOrdenOriginante && {
              numeroOrden: bancoPayload.numeroOrdenOriginante
            }),
            ...(bancoPayload?.nombreCliente && {
              nombreCliente: bancoPayload.nombreCliente
            }),
            ...(bancoPayload?.documentoCliente && {
              documentoCliente: bancoPayload.documentoCliente
            }),
            ...(bancoPayload?.cuentaCliente && {
              cuentaCliente: bancoPayload.cuentaCliente
            }),
            ...(bancoPayload?.fechaproceso && {
              fechaproceso: new Date(bancoPayload.fechaproceso)
            })
          }
        });

        // 4. Actualizar TODAS las compras PENDIENTES a PAGADO
        await tx.compra.updateMany({
          where: {
            id: { in: comprasPendientes.map(c => c.id) }
          },
          data: {
            estadoPago: 'PAGADO' as any,
            metodoPago: 'QR BANCO',
            qrPagoId: qrPagoId, // Vincular todas las compras al QR
            qrPagoAlias: qrPago.alias
          }
        });

        // 5. Actualizar TODOS los asientos a VENDIDO
        const asientoIds = comprasPendientes.map(c => c.asientoId).filter(Boolean);
        if (asientoIds.length > 0) {
          await tx.asiento.updateMany({
            where: { id: { in: asientoIds } },
            data: { estado: 'VENDIDO' as any, reservadoEn: null }
          });
        }

        console.log(`✅ Pago procesado: QR ${qrPago.alias} - ${comprasPendientes.length} compras actualizadas`);
      });
    } catch (error: any) {
      console.error('❌ Error en procesarPagoQr:', error);
      throw new PagoQrError(`Error procesando pago: ${error.message}`, 'PROCESAR_PAGO_ERROR', 500);
    }
  }

  /**
   * Manejar webhook del banco
   */
  async manejarWebhook(payload: any): Promise<{ codigo: string; mensaje: string }> {
    try {
      // Validar campos requeridos del banco
      if (!payload.alias) {
        console.warn('⚠️ Webhook sin alias');
        return { codigo: '1299', mensaje: 'Alias es requerido' };
      }

      console.log('📬 Webhook recibido del banco:', {
        alias: payload.alias,
        numeroOrdenOriginante: payload.numeroOrdenOriginante,
        monto: payload.monto,
        idQr: payload.idQr,
        nombreCliente: payload.nombreCliente,
        documentoCliente: payload.documentoCliente,
        fechaproceso: payload.fechaproceso,
        timestamp: new Date().toISOString()
      });

      // 1. Buscar QR por alias
      const qrPago = await prisma.qrPagos.findUnique({
        where: { alias: payload.alias }
      });

      if (!qrPago) {
        console.warn('⚠️ Alias no encontrado:', payload.alias);
        return { codigo: '1212', mensaje: 'Alias no encontrado en la base de datos' };
      }

      // Validar estado del QR
      if (qrPago.estado === ESTADO_QR_PAGADO) {
        console.log('✅ QR ya estaba pagado:', qrPago.alias);
        return { codigo: '0000', mensaje: 'Registro Exitoso (ya estaba pagado)' };
      }

      if (qrPago.estado === ESTADO_QR_PENDIENTE) {
        console.log('💰 Procesando pago PENDIENTE:', qrPago.alias);
        await this.procesarPagoQr(qrPago.id, payload);
        return { codigo: '0000', mensaje: 'Registro Exitoso' };
      }

      console.warn('⚠️ QR en estado no válido para procesar:', qrPago.alias, qrPago.estado);
      return { codigo: '1212', mensaje: 'Estado no válido para procesar' };
    } catch (error: any) {
      console.error('❌ Error en manejarWebhook:', error);
      return { codigo: '1299', mensaje: 'Error interno del servidor' };
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

    return { compras: compras as CompraConDetalles[], total };
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

    if (!compra || compra.usuarioId !== usuarioId) return null;

    return compra as CompraConDetalles;
  }

  /**
   * Cancelar QR
   * Cancela el QR y todas las compras relacionadas del mismo usuario/evento
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

      if (qrPago.estado === ESTADO_QR_PAGADO) {
        throw new PagoQrError('No se puede cancelar un QR que ya ha sido pagado', 'QR_ALREADY_PAID', 400);
      }

      await prisma.$transaction(async (tx) => {
        // Actualizar QR a CANCELADO
        await tx.qrPagos.update({
          where: { id: qrId },
          data: { estado: ESTADO_QR_CANCELADO }
        });

        if (qrPago.compraId && qrPago.compra) {
          // Buscar todas las compras PENDIENTES del mismo usuario/evento
          const comprasPendientes = await tx.compra.findMany({
            where: {
              usuarioId: qrPago.compra.usuarioId,
              eventoId: qrPago.compra.eventoId,
              estadoPago: ESTADO_PAGO_PENDIENTE,
              createdAt: {
                gte: new Date(Date.now() - 15 * 60 * 1000)
              }
            },
            include: { asiento: true }
          });

          console.log(`🔍 Cancelando ${comprasPendientes.length} compras relacionadas`);

          // Actualizar todas las compras a FALLIDO
          await tx.compra.updateMany({
            where: { id: { in: comprasPendientes.map(c => c.id) } },
            data: { estadoPago: ESTADO_PAGO_FALLIDO }
          });

          // Liberar todos los asientos
          const asientoIds = comprasPendientes.map(c => c.asientoId).filter(Boolean);
          if (asientoIds.length > 0) {
            await tx.asiento.updateMany({
              where: { id: { in: asientoIds } },
              data: { estado: ESTADO_ASIENTO_DISPONIBLE, reservadoEn: null }
            });
          }
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
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `TICKET|${asientoId}|${timestamp}|${random}`;
  }

  /**
   * Limpieza de QRs vencidos (cron job)
   * Devuelve información sobre la limpieza realizada
   */
  async limpiarQrsVencidos(): Promise<{ limpiados: number; tiempo: number }> {
    const ahora = new Date();
    const inicio = Date.now();

    console.log('🔍 Buscando QRs vencidos para limpieza...');

    // Primero, ver todos los QRs PENDIENTE para debugging
    const todosPendientes = await prisma.qrPagos.findMany({
      where: { estado: ESTADO_QR_PENDIENTE },
      select: { id: true, alias: true, fechaVencimiento: true, estado: true }
    });

    console.log(`📋 Total QRs PENDIENTE: ${todosPendientes.length}`);

    if (todosPendientes.length > 0) {
      console.log('📋 QRs PENDIENTE encontrados:');
      todosPendientes.forEach(qr => {
        const vencido = qr.fechaVencimiento < ahora;
        console.log(`  - ${qr.alias}: Vencido=${vencido}, Fecha=${qr.fechaVencimiento.toISOString()}`);
      });
    }

    const qrsVencidos = await prisma.qrPagos.findMany({
      where: {
        estado: ESTADO_QR_PENDIENTE,
        fechaVencimiento: { lt: ahora }
      },
      include: { compra: true }
    });

    console.log(`📊 QRs vencidos encontrados: ${qrsVencidos.length}`);

    if (qrsVencidos.length === 0) {
      return { limpiados: 0, tiempo: Date.now() - inicio };
    }

    for (const qr of qrsVencidos) {
      await prisma.$transaction(async (tx) => {
        // Actualizar QR a VENCIDO
        await tx.qrPagos.update({
          where: { id: qr.id },
          data: { estado: ESTADO_QR_VENCIDO }
        });

        if (qr.compraId) {
          await tx.compra.update({
            where: { id: qr.compraId },
            data: { estadoPago: ESTADO_PAGO_FALLIDO }
          });
        }

        if (qr.compra?.asientoId) {
          await tx.asiento.update({
            where: { id: qr.compra.asientoId },
            data: { estado: ESTADO_ASIENTO_DISPONIBLE, reservadoEn: null }
          });
          console.log(`✅ Asiento liberado: ${qr.compra.asientoId} (era reservado para QR ${qr.alias})`);
        }
      });

      console.log(`🗑️ QR vencido limpiado: ${qr.alias} - Monto: ${qr.monto} ${qr.moneda}`);
    }

    const tiempo = Date.now() - inicio;
    console.log(`✅ Limpieza completada: ${qrsVencidos.length} QRs vencidos en ${tiempo}ms`);

    return { limpiados: qrsVencidos.length, tiempo };
  }
}

export default new ComprasService();
