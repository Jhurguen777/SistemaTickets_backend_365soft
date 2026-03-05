/**
 * CONTROLADOR DE CERTIFICADOS
 * Sistema de Tickets 365Soft
 */

import { Request, Response } from 'express';
import prisma from '../../shared/config/database';
import certificadosService from './certificados.service';

class CertificadosController {
  /**
   * Obtener todas las plantillas de certificado
   * GET /api/certificados/plantillas
   */
  async obtenerPlantillas(req: Request, res: Response): Promise<void> {
    try {
      const plantillas = await certificadosService.obtenerPlantillas();
      res.json({
        success: true,
        data: plantillas
      });
    } catch (error: any) {
      console.error('Error en obtenerPlantillas:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener plantillas'
      });
    }
  }

  /**
   * Obtener una plantilla por ID
   * GET /api/certificados/plantillas/:id
   */
  async obtenerPlantilla(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const plantilla = await certificadosService.obtenerPlantilla(id);
      res.json({
        success: true,
        data: plantilla
      });
    } catch (error: any) {
      console.error('Error en obtenerPlantilla:', error);
      res.status(error.message === 'Plantilla no encontrada' ? 404 : 500).json({
        success: false,
        message: error.message || 'Error al obtener plantilla'
      });
    }
  }

  /**
   * Crear una nueva plantilla
   * POST /api/certificados/plantillas
   */
  async crearPlantilla(req: Request, res: Response): Promise<void> {
    try {
      const { nombre, tipo, descripcion, contenido } = req.body;
      const creadorId = (req as any).user?.id;

      if (!nombre || !tipo || !contenido) {
        res.status(400).json({
          success: false,
          message: 'Faltan campos obligatorios: nombre, tipo, contenido'
        });
        return;
      }

      const plantilla = await certificadosService.crearPlantilla({
        nombre,
        tipo,
        descripcion,
        contenido,
        creadorId
      });

      res.status(201).json({
        success: true,
        message: 'Plantilla creada exitosamente',
        data: plantilla
      });
    } catch (error: any) {
      console.error('Error en crearPlantilla:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al crear plantilla'
      });
    }
  }

  /**
   * Actualizar una plantilla
   * PUT /api/certificados/plantillas/:id
   */
  async actualizarPlantilla(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { nombre, tipo, descripcion, contenido, activo } = req.body;

      const plantilla = await certificadosService.actualizarPlantilla(id, {
        nombre,
        tipo,
        descripcion,
        contenido,
        activo
      });

      res.json({
        success: true,
        message: 'Plantilla actualizada exitosamente',
        data: plantilla
      });
    } catch (error: any) {
      console.error('Error en actualizarPlantilla:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al actualizar plantilla'
      });
    }
  }

  /**
   * Eliminar una plantilla (soft delete)
   * DELETE /api/certificados/plantillas/:id
   */
  async eliminarPlantilla(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await certificadosService.eliminarPlantilla(id);

      res.json({
        success: true,
        message: 'Plantilla eliminada exitosamente'
      });
    } catch (error: any) {
      console.error('Error en eliminarPlantilla:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al eliminar plantilla'
      });
    }
  }

  /**
   * Generar certificado individual
   * POST /api/certificados/generar
   */
  async generarCertificado(req: Request, res: Response): Promise<void> {
    try {
      const { plantillaId, compraId, usuarioId, nombreDestinatario, emailDestinatario } = req.body;

      if (!plantillaId) {
        res.status(400).json({
          success: false,
          message: 'plantillaId es obligatorio'
        });
        return;
      }

      const certificado = await certificadosService.generarCertificado({
        plantillaId,
        compraId,
        usuarioId,
        nombreDestinatario,
        emailDestinatario
      });

      res.status(201).json({
        success: true,
        message: 'Certificado generado exitosamente',
        data: certificado
      });
    } catch (error: any) {
      console.error('Error en generarCertificado:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al generar certificado'
      });
    }
  }

  /**
   * Enviar certificados por email
   * POST /api/certificados/enviar
   */
  async enviarCertificados(req: Request, res: Response): Promise<void> {
    try {
      const { plantillaId, eventoId, compraIds } = req.body;
      const usuarioId = (req as any).user?.id;

      if (!plantillaId || !eventoId) {
        res.status(400).json({
          success: false,
          message: 'plantillaId y eventoId son obligatorios'
        });
        return;
      }

      const resultado = await certificadosService.enviarCertificados({
        plantillaId,
        eventoId,
        compraIds,
        usuarioId
      });

      res.json({
        success: true,
        message: 'Proceso de envío completado',
        data: resultado
      });
    } catch (error: any) {
      console.error('Error en enviarCertificados:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al enviar certificados'
      });
    }
  }

  /**
   * Obtener certificados de un evento
   * GET /api/certificados/eventos/:eventoId
   */
  async obtenerCertificadosEvento(req: Request, res: Response): Promise<void> {
    try {
      const { eventoId } = req.params;
      const certificados = await certificadosService.obtenerCertificadosEvento(eventoId);

      res.json({
        success: true,
        data: certificados
      });
    } catch (error: any) {
      console.error('Error en obtenerCertificadosEvento:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener certificados del evento'
      });
    }
  }

  /**
   * Obtener certificados de un usuario
   * GET /api/certificados/usuario/:usuarioId
   */
  async obtenerCertificadosUsuario(req: Request, res: Response): Promise<void> {
    try {
      const { usuarioId } = req.params;
      const certificados = await certificadosService.obtenerCertificadosUsuario(usuarioId);

      res.json({
        success: true,
        data: certificados
      });
    } catch (error: any) {
      console.error('Error en obtenerCertificadosUsuario:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener certificados del usuario'
      });
    }
  }

  /**
   * Obtener historial de envíos
   * GET /api/certificados/historial
   */
  async obtenerHistorialEnvios(req: Request, res: Response): Promise<void> {
    try {
      const historial = await certificadosService.obtenerHistorialEnvios();

      res.json({
        success: true,
        data: historial
      });
    } catch (error: any) {
      console.error('Error en obtenerHistorialEnvios:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener historial de envíos'
      });
    }
  }

  /**
   * Descargar certificado PDF
   * GET /api/certificados/:compraId/descargar
   */
  async descargarCertificado(req: Request, res: Response): Promise<void> {
    try {
      const { compraId } = req.params;

      // Buscar certificado por compraId
      const certificado = await prisma.certificado.findFirst({
        where: { compraId },
        include: {
          compra: true
        }
      });

      if (!certificado) {
        res.status(404).json({
          success: false,
          message: 'Certificado no encontrado'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Descargar certificado PDF',
        data: {
          url: certificado.urlArchivo,
          codigo: certificado.codigo
        }
      });
    } catch (error: any) {
      console.error('Error en descargarCertificado:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al descargar certificado'
      });
    }
  }
}

export default new CertificadosController();
