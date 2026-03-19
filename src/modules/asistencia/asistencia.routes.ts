import { Router } from "express";
import { AsistenciaController } from "./asistencia.controller";
import { authenticate, hasRole } from "../../shared/middleware/auth";

const router = Router();
const controller = new AsistenciaController();

const asistenciaAccess = hasRole('GESTOR_EVENTOS', 'GESTOR_ASISTENCIA');

// POST /api/asistencia/verificar-qr
router.post("/verificar-qr", authenticate, asistenciaAccess, controller.verificarQR);

// POST /api/asistencia/manual
router.post("/manual", authenticate, asistenciaAccess, controller.marcarAsistenciaManual);

// GET /api/asistencia/evento/:eventoId
router.get("/evento/:eventoId", authenticate, asistenciaAccess, controller.listarAsistentes);

// GET /api/asistencia/stats/:eventoId
router.get("/stats/:eventoId", authenticate, asistenciaAccess, controller.obtenerStats);

// GET /api/asistencia/exportar/:eventoId
router.get("/exportar/:eventoId", authenticate, asistenciaAccess, controller.exportarExcel);

export default router;