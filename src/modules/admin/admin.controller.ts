// src/modules/admin/admin.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  getDashboardKPIs,
  getSalesReport,
  getAttendanceReport,
  getAgenciesRanking,
  exportToCSV,
} from './admin.service';

// ── DASHBOARD KPIs ─────────────────────────────────────────────
export const getDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.rol !== 'ADMIN') {
      res.status(403).json({ error: 'Acceso denegado' });
      return;
    }

    const kpis = await getDashboardKPIs();

    res.json({
      success: true,
      data: kpis
    });
  } catch (error) {
    console.error('❌ Error al obtener dashboard:', error);
    res.status(500).json({ error: 'Error al obtener dashboard' });
  }
};

// ── REPORTES DE VENTAS ───────────────────────────────────────────
export const getSales = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.rol !== 'ADMIN') {
      res.status(403).json({ error: 'Acceso denegado' });
      return;
    }

    const { startDate, endDate, eventoId } = req.query;

    const report = await getSalesReport({
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      eventoId: eventoId as string | undefined,
    });

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('❌ Error al obtener reporte de ventas:', error);
    res.status(500).json({ error: 'Error al obtener reporte de ventas' });
  }
};

// ── REPORTES DE ASISTENCIA ────────────────────────────────────────
export const getAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.rol !== 'ADMIN') {
      res.status(403).json({ error: 'Acceso denegado' });
      return;
    }

    const { eventoId } = req.query;

    const report = await getAttendanceReport(eventoId as string | undefined);

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('❌ Error al obtener reporte de asistencia:', error);
    res.status(500).json({ error: 'Error al obtener reporte de asistencia' });
  }
};

// ── REPORTES POR AGENCIAS (RANKING) ───────────────────────────────
export const getAgencies = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.rol !== 'ADMIN') {
      res.status(403).json({ error: 'Acceso denegado' });
      return;
    }

    const { startDate, endDate, limit } = req.query;

    const ranking = await getAgenciesRanking({
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string) : 10,
    });

    res.json({
      success: true,
      data: ranking
    });
  } catch (error) {
    console.error('❌ Error al obtener ranking de agencias:', error);
    res.status(500).json({ error: 'Error al obtener ranking de agencias' });
  }
};

// ── EXPORTAR A CSV/EXCEL ──────────────────────────────────────────
export const exportData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.rol !== 'ADMIN') {
      res.status(403).json({ error: 'Acceso denegado' });
      return;
    }

    const { type, startDate, endDate, eventoId } = req.query;

    if (!type || (type !== 'ventas' && type !== 'asistencia' && type !== 'agencias')) {
      res.status(400).json({ error: 'Tipo de exportación inválido' });
      return;
    }

    const csvData = await exportToCSV({
      type: type as 'ventas' | 'asistencia' | 'agencias',
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      eventoId: eventoId as string | undefined,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-${Date.now()}.csv`);

    res.send(csvData);
  } catch (error) {
    console.error('❌ Error al exportar datos:', error);
    res.status(500).json({ error: 'Error al exportar datos' });
  }
};
