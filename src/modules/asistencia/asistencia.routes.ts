import { Router } from "express";
import { AsistenciaController } from "./asistencia.controller";
import { authenticate, adminOnly } from "../../shared/middleware/auth";

const router = Router();
const controller = new AsistenciaController();

// POST /api/asistencia/verificar-qr
// Verifica el QR y registra el ingreso al evento
// Requiere: Admin autenticado
router.post("/verificar-qr", authenticate, adminOnly, controller.verificarQR);


// GET /api/asistencia/evento/:eventoId
// Retorna la lista de todos los asistentes de un evento
// Requiere: Admin autenticado
router.get("/evento/:eventoId", authenticate, adminOnly, controller.listarAsistentes);


// GET /api/asistencia/stats/:eventoId
// Retorna estadísticas de asistencia del evento
// Requiere: Admin autenticado
router.get("/stats/:eventoId", authenticate, adminOnly, controller.obtenerStats);


// GET /api/asistencia/exportar/:eventoId
// Exporta la lista de asistentes en formato Excel (.xlsx)
// Requiere: Admin autenticado
router.get("/exportar/:eventoId", authenticate, adminOnly, controller.exportarExcel);

export default router;