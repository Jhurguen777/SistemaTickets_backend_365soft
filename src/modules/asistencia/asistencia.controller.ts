import { Request, Response } from "express";
import { AsistenciaService } from "./asistencia.service";

const asistenciaService = new AsistenciaService();

export class AsistenciaController {
  // POST /api/asistencia/verificar-qr
  verificarQR = async (req: Request, res: Response): Promise<void> => {
    try {
      const { qrCode, latitud, longitud } = req.body;

      if (!qrCode) {
        res.status(400).json({
          ok: false,
          mensaje: "El campo qrCode es requerido",
        });
        return;
      }

      // Busca el QR directamente como string (formato: QR-XXX-timestamp)
      const resultado = await asistenciaService.verificarYRegistrar({
        qrCode,
        latitud: latitud ?? null,
        longitud: longitud ?? null,
        adminId: (req as any).user.id,
      });

      res.status(200).json({
        ok: true,
        mensaje: "Ingreso registrado correctamente",
        data: resultado,
      });
    } catch (error: any) {
      const erroresConocidos = [
        "QR no encontrado",
        "Compra no está pagada",
        "QR ya fue utilizado",
      ];

      if (erroresConocidos.includes(error.message)) {
        res.status(422).json({ ok: false, mensaje: error.message });
      } else {
        console.error("[AsistenciaController.verificarQR]", error);
        res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
      }
    }
  };

  // GET /api/asistencia/evento/:eventoId
  listarAsistentes = async (req: Request, res: Response): Promise<void> => {
    try {
      const { eventoId } = req.params;
      const asistentes = await asistenciaService.listarPorEvento(eventoId);
      res.status(200).json({ ok: true, total: asistentes.length, data: asistentes });
    } catch (error) {
      console.error("[AsistenciaController.listarAsistentes]", error);
      res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
    }
  };

  // GET /api/asistencia/stats/:eventoId
  obtenerStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const { eventoId } = req.params;
      const stats = await asistenciaService.obtenerEstadisticas(eventoId);
      res.status(200).json({ ok: true, data: stats });
    } catch (error) {
      console.error("[AsistenciaController.obtenerStats]", error);
      res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
    }
  };

  // GET /api/asistencia/exportar/:eventoId
  exportarExcel = async (req: Request, res: Response): Promise<void> => {
    try {
      const { eventoId } = req.params;
      const buffer = await asistenciaService.generarExcel(eventoId);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="asistencia_evento_${eventoId}.xlsx"`);
      res.send(buffer);
    } catch (error) {
      console.error("[AsistenciaController.exportarExcel]", error);
      res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
    }
  };
}