/**
 * SERVICIO DE CERTIFICADOS
 * Sistema de Tickets 365Soft
 */

import prisma from '../../shared/config/database';
import { TipoCertificado } from '@prisma/client';

// Interfaces
interface CrearPlantillaRequest {
  nombre: string;
  tipo: TipoCertificado;
  descripcion?: string;
  contenido: string;
  creadorId?: string;
}

interface ActualizarPlantillaRequest {
  nombre?: string;
  tipo?: TipoCertificado;
  descripcion?: string;
  contenido?: string;
  activo?: boolean;
}

interface GenerarCertificadoRequest {
  plantillaId: string;
  compraId?: string;
  usuarioId?: string;
  nombreDestinatario?: string;
  emailDestinatario?: string;
}

interface EnviarCertificadosRequest {
  plantillaId: string;
  eventoId: string;
  compraIds?: string[]; // Opcional, si se envía a compras específicas
  usuarioId?: string; // Admin que envía
}

interface CertificadoData {
  nombre_completo?: string;
  ci?: string;
  telefono?: string;
  oficina_alfa?: string;
  fecha?: string;
  evento?: string;
  mensaje?: string;
}

class CertificadosService {
  /**
   * Obtener todas las plantillas
   */
  async obtenerPlantillas(): Promise<any[]> {
    const plantillas = await prisma.plantillaCertificado.findMany({
      where: { activo: true },
      orderBy: { createdAt: 'desc' },
      include: {
        creador: {
          select: { id: true, nombre: true, email: true }
        },
        _count: {
          select: { certificados: true }
        }
      }
    });

    return plantillas.map(p => ({
      ...p,
      cantidadCertificados: p._count.certificados
    }));
  }

  /**
   * Obtener una plantilla por ID
   */
  async obtenerPlantilla(id: string): Promise<any> {
    const plantilla = await prisma.plantillaCertificado.findUnique({
      where: { id },
      include: {
        creador: {
          select: { id: true, nombre: true, email: true }
        },
        _count: {
          select: { certificados: true }
        }
      }
    });

    if (!plantilla) {
      throw new Error('Plantilla no encontrada');
    }

    return {
      ...plantilla,
      cantidadCertificados: plantilla._count.certificados
    };
  }

  /**
   * Crear una nueva plantilla
   */
  async crearPlantilla(data: CrearPlantillaRequest): Promise<any> {
    const plantilla = await prisma.plantillaCertificado.create({
      data: {
        nombre: data.nombre,
        tipo: data.tipo,
        descripcion: data.descripcion,
        contenido: data.contenido,
        creadorId: data.creadorId
      }
    });

    return plantilla;
  }

  /**
   * Actualizar una plantilla
   */
  async actualizarPlantilla(id: string, data: ActualizarPlantillaRequest): Promise<any> {
    const plantilla = await prisma.plantillaCertificado.update({
      where: { id },
      data
    });

    return plantilla;
  }

  /**
   * Eliminar una plantilla (soft delete)
   */
  async eliminarPlantilla(id: string): Promise<void> {
    await prisma.plantillaCertificado.update({
      where: { id },
      data: { activo: false }
    });
  }

  /**
   * Generar certificado individual
   */
  async generarCertificado(data: GenerarCertificadoRequest): Promise<any> {
    // 1. Verificar que la plantilla existe
    const plantilla = await prisma.plantillaCertificado.findUnique({
      where: { id: data.plantillaId }
    });

    if (!plantilla) {
      throw new Error('Plantilla no encontrada');
    }

    // 2. Obtener datos del destinatario
    let nombreDestinatario = data.nombreDestinatario;
    let emailDestinatario = data.emailDestinatario;
    let usuarioId = data.usuarioId;

    if (data.compraId) {
      const compra = await prisma.compra.findUnique({
        where: { id: data.compraId },
        include: {
          usuario: true,
          evento: true
        }
      });

      if (!compra) {
        throw new Error('Compra no encontrada');
      }

      nombreDestinatario = compra.usuario.nombre;
      emailDestinatario = compra.usuario.email;
      usuarioId = compra.usuarioId;

      // Preparar datos para reemplazar variables
      const datosParaPlantilla = this.prepararDatosPlantilla(compra, plantilla.contenido);

      // 3. Reemplazar variables en el HTML
      const htmlConDatos = this.reemplazarVariables(plantilla.contenido, datosParaPlantilla);

      // 4. Generar PDF (simulado por ahora)
      const urlArchivo = await this.generarPDF(htmlConDatos);

      // 5. Generar código único de verificación
      const codigo = this.generarCodigoUnico(usuarioId || data.compraId);

      // 6. Crear registro de certificado
      const certificado = await prisma.certificado.create({
        data: {
          compraId: data.compraId,
          usuarioId,
          plantillaId: data.plantillaId,
          nombreDestinatario,
          emailDestinatario,
          codigo,
          urlArchivo
        }
      });

      // 7. Actualizar compra con URL del certificado
      await prisma.compra.update({
        where: { id: data.compraId },
        data: { certificadoUrl: urlArchivo }
      });

      return certificado;
    }

    // Caso sin compra (certificado manual)
    if (!nombreDestinatario) {
      throw new Error('Debe proporcionar nombre del destinatario o compraId');
    }

    const codigo = this.generarCodigoUnico(nombreDestinatario + Date.now());
    const htmlFinal = plantilla.contenido;
    const urlArchivo = await this.generarPDF(htmlFinal);

    const certificado = await prisma.certificado.create({
      data: {
        usuarioId,
        plantillaId: data.plantillaId,
        nombreDestinatario,
        emailDestinatario,
        codigo,
        urlArchivo
      }
    });

    return certificado;
  }

  /**
   * Enviar certificados por email
   */
  async enviarCertificados(data: EnviarCertificadosRequest): Promise<any> {
    // 1. Verificar plantilla
    const plantilla = await prisma.plantillaCertificado.findUnique({
      where: { id: data.plantillaId }
    });

    if (!plantilla) {
      throw new Error('Plantilla no encontrada');
    }

    // 2. Obtener compras a las que enviar certificados
    let compras;

    if (data.compraIds && data.compraIds.length > 0) {
      // Enviar a compras específicas
      compras = await prisma.compra.findMany({
        where: {
          id: { in: data.compraIds },
          estadoPago: 'PAGADO'
        },
        include: {
          usuario: true,
          evento: true,
          certificado: true
        }
      });
    } else {
      // Enviar a todas las compras pagadas del evento
      compras = await prisma.compra.findMany({
        where: {
          eventoId: data.eventoId,
          estadoPago: 'PAGADO'
        },
        include: {
          usuario: true,
          evento: true,
          certificado: true
        }
      });
    }

    let cantidadEnviada = 0;
    let cantidadError = 0;
    const errores: string[] = [];

    // 3. Procesar cada compra
    for (const compra of compras) {
      try {
        // Si no tiene certificado, generarlo
        if (!compra.certificado) {
          await this.generarCertificado({
            plantillaId: data.plantillaId,
            compraId: compra.id
          });
        }

        // Enviar email (simulado)
        await this.enviarEmailCertificado(compra.usuario.email, compra.usuario.nombre);

        // Marcar como enviado
        await prisma.certificado.updateMany({
          where: {
            compraId: compra.id,
            plantillaId: data.plantillaId
          },
          data: {
            enviado: true,
            fechaEnvio: new Date()
          }
        });

        cantidadEnviada++;
      } catch (error: any) {
        cantidadError++;
        errores.push(error.message);
        console.error(`Error enviando certificado a ${compra.usuario.email}:`, error);
      }
    }

    // 4. Registrar historial de envío
    const historial = await prisma.historialEnvioCertificado.create({
      data: {
        plantillaId: data.plantillaId,
        eventoId: data.eventoId,
        usuarioId: data.usuarioId,
        cantidadEnviada,
        cantidadError,
        error: errores.length > 0 ? errores.join(', ') : null
      }
    });

    return {
      historial,
      estadisticas: {
        total: compras.length,
        enviados: cantidadEnviada,
        errores: cantidadError
      }
    };
  }

  /**
   * Obtener certificados de un evento
   */
  async obtenerCertificadosEvento(eventoId: string): Promise<any[]> {
    const certificados = await prisma.certificado.findMany({
      where: {
        compra: {
          eventoId
        }
      },
      include: {
        compra: {
          include: {
            usuario: {
              select: { id: true, nombre: true, email: true }
            },
            evento: {
              select: { id: true, titulo: true }
            }
          }
        },
        plantilla: {
          select: { id: true, nombre: true }
        }
      },
      orderBy: { fechaEmision: 'desc' }
    });

    return certificados;
  }

  /**
   * Obtener certificados de un usuario
   */
  async obtenerCertificadosUsuario(usuarioId: string): Promise<any[]> {
    const certificados = await prisma.certificado.findMany({
      where: { usuarioId },
      include: {
        compra: {
          select: {
            id: true,
            evento: {
              select: { id: true, titulo: true, fecha: true }
            }
          }
        },
        plantilla: {
          select: { id: true, nombre: true, tipo: true }
        }
      },
      orderBy: { fechaEmision: 'desc' }
    });

    return certificados;
  }

  /**
   * Obtener historial de envíos
   */
  async obtenerHistorialEnvios(): Promise<any[]> {
    const historial = await prisma.historialEnvioCertificado.findMany({
      include: {
        plantilla: {
          select: { id: true, nombre: true }
        }
      },
      orderBy: { fechaEnvio: 'desc' },
      take: 50
    });

    return historial;
  }

  /**
   * Preparar datos para reemplazar variables en la plantilla
   */
  private prepararDatosPlantilla(compra: any, contenido: string): CertificadoData {
    const datos: CertificadoData = {
      nombre_completo: compra.usuario.nombre,
      ci: compra.usuario.ci || '',
      telefono: compra.usuario.telefono || '',
      oficina_alfa: compra.usuario.agencia || '',
      fecha: new Date(compra.evento.fecha).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      evento: compra.evento.titulo,
      mensaje: 'Felicitaciones por su participación en el evento.'
    };

    return datos;
  }

  /**
   * Reemplazar variables en el HTML
   */
  private reemplazarVariables(html: string, datos: CertificadoData): string {
    let htmlProcesado = html;

    Object.entries(datos).forEach(([clave, valor]) => {
      const regex = new RegExp(`\\{\\{${clave}\\}\\}`, 'g');
      htmlProcesado = htmlProcesado.replace(regex, valor || '');
    });

    return htmlProcesado;
  }

  /**
   * Generar código único de verificación
   */
  private generarCodigoUnico(semilla: string): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const hash = Buffer.from(semilla).toString('base64').substring(0, 8);
    return `CERT-${timestamp}-${hash}-${random}`.toUpperCase();
  }

  /**
   * Generar PDF a partir del HTML
   */
  private async generarPDF(html: string): Promise<string> {
    // Por ahora simulamos la generación
    // En producción usar puppeteer o similar para generar el PDF real
    const timestamp = Date.now();
    const nombreArchivo = `certificado-${timestamp}.pdf`;
    const urlArchivo = `https://certificados.365soft.com/${nombreArchivo}`;

    console.log('📄 Generando PDF:', nombreArchivo);

    // Simulación de tiempo de generación
    await new Promise(resolve => setTimeout(resolve, 500));

    return urlArchivo;
  }

  /**
   * Enviar email con certificado
   */
  private async enviarEmailCertificado(email: string, nombre: string): Promise<void> {
    // Simulación de envío de email
    console.log(`📧 Enviando certificado a ${email} (${nombre})`);

    // En producción, aquí se usaría un servicio de email real
    // como SendGrid, Mailgun, Nodemailer, etc.

    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

export default new CertificadosService();
