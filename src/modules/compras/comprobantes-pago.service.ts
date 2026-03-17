/**
 * SERVICIO DE COMPROBANTES DE PAGO (EFECTIVO)
 * Sistema de Tickets 365Soft
 */

import prisma from '../../shared/config/database';

// Estado constants as strings
const ESTADO_COMPROBANTE_PENDIENTE = 'PENDIENTE';
const ESTADO_COMPROBANTE_APROBADO = 'APROBADO';
const ESTADO_COMPROBANTE_RECHAZADO = 'RECHAZADO';
const ESTADO_PAGO_PENDIENTE_APROBACION = 'PENDIENTE_APROBACION';
const ESTADO_PAGO_PAGADO = 'PAGADO';
const ESTADO_PAGO_RECHAZADO = 'RECHAZADO';

interface SubirComprobanteRequest {
  compraId: string;
  imagenBase64: string;
  nombreArchivo?: string;
  tipoArchivo?: string;
}

interface SubirComprobanteResponse {
  success: boolean;
  message: string;
  comprobante?: {
    id: string;
    imagenUrl: string;
    estado: string;
    fechaSubida: string;
  };
}

interface AprobarComprobanteResponse {
  success: boolean;
  message: string;
  compra?: {
    id: string;
    estadoPago: string;
    asientos?: Array<{ fila: string; numero: number }>;
    numeroBoletos?: number[];
  };
}

interface ListarComprobantesParams {
  estado?: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
  page?: number;
  limit?: number;
}

class ComprobantesPagoService {
  /**
   * Subir comprobante de pago
   */
  async subirComprobante(
    usuarioId: string,
    data: SubirComprobanteRequest
  ): Promise<SubirComprobanteResponse> {
    try {
      // Verificar que la compra pertenezca al usuario
      const compra = await prisma.compra.findUnique({
        where: { id: data.compraId },
        include: {
          usuario: { select: { id: true, email: true, nombre: true } },
          evento: { select: { titulo: true } },
          asiento: { select: { fila: true, numero: true } }
        }
      });

      if (!compra) {
        return {
          success: false,
          message: 'Compra no encontrada'
        };
      }

      if (compra.usuarioId !== usuarioId) {
        return {
          success: false,
          message: 'No tienes permiso para subir este comprobante'
        };
      }

      // Validar imagen base64
      if (!data.imagenBase64 || !data.imagenBase64.startsWith('data:image/')) {
        return {
          success: false,
          message: 'Formato de imagen inválido. Solo se aceptan JPG y PNG.'
        };
      }

      // Extra información del formato
      const matches = data.imagenBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches || matches.length < 3) {
        return {
          success: false,
          message: 'Error al procesar la imagen'
        };
      }

      const mimeType = matches[1];
      const base64Data = matches[2];
      const tamanoBytes = Math.round((base64Data.length * 3) / 4);

      // Validar tamaño (máximo 5MB)
      if (tamanoBytes > 5 * 1024 * 1024) {
        return {
          success: false,
          message: 'La imagen excede el tamaño máximo de 5MB'
        };
      }

      // Crear comprobante
      const comprobante = await prisma.comprobantePago.create({
        data: {
          compraId: data.compraId,
          imagenUrl: data.imagenBase64,
          nombreArchivo: data.nombreArchivo,
          tipoArchivo: mimeType,
          tamanoBytes,
          estado: ESTADO_COMPROBANTE_PENDIENTE
        }
      });

      // Actualizar compra a PENDIENTE_APROBACION
      await prisma.compra.update({
        where: { id: data.compraId },
        data: {
          estadoPago: ESTADO_PAGO_PENDIENTE_APROBACION,
          metodoPago: 'EFECTIVO'
        }
      });

      console.log('✅ Comprobante subido:', {
        comprobanteId: comprobante.id,
        compraId: data.compraId,
        usuarioId,
        tipoArchivo: mimeType,
        tamanoBytes
      });

      return {
        success: true,
        message: 'Comprobante subido exitosamente. Tu compra está pendiente de aprobación.',
        comprobante: {
          id: comprobante.id,
          imagenUrl: comprobante.imagenUrl,
          estado: comprobante.estado,
          fechaSubida: comprobante.fechaSubida.toISOString()
        }
      };
    } catch (error: any) {
      console.error('Error al subir comprobante:', error);
      return {
        success: false,
        message: 'Error al subir el comprobante. Por favor intenta nuevamente.'
      };
    }
  }

  /**
   * Aprobar comprobante de pago
   * Actualiza la compra a PAGADO y genera tickets
   */
  async aprobarComprobante(
    comprobanteId: string,
    adminId: string
  ): Promise<AprobarComprobanteResponse> {
    try {
      const comprobante = await prisma.comprobantePago.findUnique({
        where: { id: comprobanteId },
        include: {
          compra: {
            include: {
              evento: true,
              usuario: { select: { email: true, nombre: true } },
              asiento: { select: { fila: true, numero: true } }
            }
          }
        }
      });

      if (!comprobante) {
        return {
          success: false,
          message: 'Comprobante no encontrado'
        };
      }

      if (comprobante.estado !== ESTADO_COMPROBANTE_PENDIENTE) {
        return {
          success: false,
          message: 'Este comprobante ya fue procesado'
        };
      }

      // Obtener todas las compras relacionadas del mismo usuario/evento
      const comprasRelacionadas = await prisma.compra.findMany({
        where: {
          usuarioId: comprobante.compra.usuarioId,
          eventoId: comprobante.compra.eventoId,
          estadoPago: ESTADO_PAGO_PENDIENTE_APROBACION
        },
        include: { asiento: true }
      });

      await prisma.$transaction(async (tx) => {
        // Actualizar comprobante a APROBADO
        await tx.comprobantePago.update({
          where: { id: comprobanteId },
          data: {
            estado: ESTADO_COMPROBANTE_APROBADO,
            fechaRevision: new Date(),
            revisadoPor: adminId
          }
        });

        // Actualizar TODAS las compras relacionadas a PAGADO
        await tx.compra.updateMany({
          where: {
            id: { in: comprasRelacionadas.map(c => c.id) }
          },
          data: {
            estadoPago: ESTADO_PAGO_PAGADO,
            metodoPago: 'EFECTIVO'
          }
        });

        // Actualizar asientos a VENDIDO
        const asientoIds = comprasRelacionadas
          .map(c => c.asientoId)
          .filter((id): id is string => id !== null);

        if (asientoIds.length > 0) {
          await tx.asiento.updateMany({
            where: { id: { in: asientoIds } },
            data: { estado: 'VENDIDO', reservadoEn: null }
          });
        }

        // Actualizar sectores (disponible decrement)
        const cantidadComprada = comprasRelacionadas.length;
        await tx.sectorEvento.updateMany({
          where: { eventoId: comprobante.compra.eventoId },
          data: { disponible: { decrement: cantidadComprada } }
        });
      });

      console.log('✅ Comprobante aprobado:', {
        comprobanteId,
        adminId,
        comprasActualizadas: comprasRelacionadas.length
      });

      return {
        success: true,
        message: 'Comprobante aprobado. Los tickets han sido generados.',
        compra: {
          id: comprobante.compra.id,
          estadoPago: 'PAGADO',
          asientos: comprasRelacionadas.map(c => c.asiento ? c.asiento as any : undefined).filter(Boolean),
          numeroBoletos: comprasRelacionadas.map(c => c.numeroBoleto).filter((n): n is number => n !== null && n !== undefined)
        }
      };
    } catch (error: any) {
      console.error('Error al aprobar comprobante:', error);
      return {
        success: false,
        message: 'Error al aprobar el comprobante'
      };
    }
  }

  /**
   * Rechazar comprobante de pago
   * Permite al usuario reintentar subir un nuevo comprobante
   */
  async rechazarComprobante(
    comprobanteId: string,
    adminId: string,
    mensajeRechazo?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const comprobante = await prisma.comprobantePago.findUnique({
        where: { id: comprobanteId },
        include: { compra: true }
      });

      if (!comprobante) {
        return {
          success: false,
          message: 'Comprobante no encontrado'
        };
      }

      if (comprobante.estado !== ESTADO_COMPROBANTE_PENDIENTE) {
        return {
          success: false,
          message: 'Este comprobante ya fue procesado'
        };
      }

      await prisma.$transaction(async (tx) => {
        // Actualizar comprobante a RECHAZADO
        await tx.comprobantePago.update({
          where: { id: comprobanteId },
          data: {
            estado: ESTADO_COMPROBANTE_RECHAZADO,
            mensajeRechazo: mensajeRechazo || 'Comprobante no válido',
            fechaRevision: new Date(),
            revisadoPor: adminId
          }
        });

        // Actualizar compra a RECHAZADO
        await tx.compra.update({
          where: { id: comprobante.compraId },
          data: { estadoPago: ESTADO_PAGO_RECHAZADO }
        });

        // Liberar asientos si es modo ASIENTOS
        if (comprobante.compra.asientoId) {
          await tx.asiento.update({
            where: { id: comprobante.compra.asientoId },
            data: { estado: 'DISPONIBLE', reservadoEn: null }
          });
        }
      });

      console.log('❌ Comprobante rechazado:', {
        comprobanteId,
        adminId,
        mensajeRechazo
      });

      return {
        success: true,
        message: 'Comprobante rechazado. El usuario puede subir un nuevo comprobante.'
      };
    } catch (error: any) {
      console.error('Error al rechazar comprobante:', error);
      return {
        success: false,
        message: 'Error al rechazar el comprobante'
      };
    }
  }

  /**
   * Listar comprobantes pendientes
   * Para el panel de administrador
   */
  async listarComprobantes(
    params: ListarComprobantesParams = {}
  ): Promise<{
    comprobantes: Array<{
      id: string;
      estado: string;
      fechaSubida: string;
      compra: {
        id: string;
        monto: number;
        moneda: string;
        estadoPago: string;
        evento: {
          id: string;
          titulo: string;
          fecha: Date;
          ubicacion: string;
        };
        usuario: {
          id: string;
          nombre: string;
          email: string;
        };
        asiento?: { fila: string; numero: number };
        numeroBoleto?: number;
      };
      imagenUrl: string;
      tipoArchivo?: string;
      tamanoBytes?: number;
    }>;
    total: number;
  }> {
    const where: any = {};

    if (params.estado) {
      where.estado = params.estado;
    }

    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const [comprobantes, total] = await Promise.all([
      prisma.comprobantePago.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fechaSubida: 'desc' },
        include: {
          compra: {
            include: {
              evento: { select: { id: true, titulo: true, fecha: true, ubicacion: true } },
              usuario: { select: { id: true, nombre: true, email: true } },
              asiento: { select: { fila: true, numero: true } }
            }
          }
        }
      }),
      prisma.comprobantePago.count({ where })
    ]);

    return {
      comprobantes: comprobantes.map(c => ({
        id: c.id,
        estado: c.estado,
        fechaSubida: c.fechaSubida.toISOString(),
        imagenUrl: c.imagenUrl,
        tipoArchivo: c.tipoArchivo ?? undefined,
        tamanoBytes: c.tamanoBytes ?? undefined,
        compra: {
          id: c.compra.id,
          monto: c.compra.monto,
          moneda: c.compra.moneda,
          estadoPago: c.compra.estadoPago,
          evento: {
            ...c.compra.evento,
            fecha: new Date(c.compra.evento.fecha)
          },
          usuario: c.compra.usuario,
          asiento: c.compra.asiento as any,
          numeroBoleto: c.compra.numeroBoleto as any
        }
      })),
      total
    };
  }

  /**
   * Obtener detalle de un comprobante
   */
  async obtenerComprobante(comprobanteId: string) {
    const comprobante = await prisma.comprobantePago.findUnique({
      where: { id: comprobanteId },
      include: {
        compra: {
          include: {
            evento: true,
            usuario: { select: { email: true, nombre: true } },
            asiento: { select: { fila: true, numero: true } },
            datosAsistente: true
          }
        }
      }
    });

    if (!comprobante) {
      return null;
    }

    return {
      id: comprobante.id,
      estado: comprobante.estado,
      fechaSubida: comprobante.fechaSubida,
      imagenUrl: comprobante.imagenUrl,
      tipoArchivo: comprobante.tipoArchivo,
      tamanoBytes: comprobante.tamanoBytes,
      nombreArchivo: comprobante.nombreArchivo,
      mensajeRechazo: comprobante.mensajeRechazo,
      fechaRevision: comprobante.fechaRevision,
      revisadoPor: comprobante.revisadoPor,
      compra: comprobante.compra
    };
  }
}

export default new ComprobantesPagoService();
