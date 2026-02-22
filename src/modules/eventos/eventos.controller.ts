// src/modules/eventos/eventos.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  getEventos,
  getEventoById,
  createEvento,
  updateEvento,
  deleteEvento,
} from './eventos.service';

// ── LISTAR EVENTOS ────────────────────────────────────────────────
export const getAllEventos = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { estado, fecha, ubicacion, page = '1', limit = '10', search } = req.query;

    const eventos = await getEventos({
      estado: estado as string,
      fecha: fecha ? new Date(fecha as string) : undefined,
      ubicacion: ubicacion as string,
      search: search as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });

    res.json({
      success: true,
      data: eventos
    });
  } catch (error) {
    console.error('❌ Error al obtener eventos:', error);
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
};

// ── OBTENER EVENTO POR ID ───────────────────────────────────────────
export const getEvento = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const evento = await getEventoById(id);

    if (!evento) {
      res.status(404).json({ error: 'Evento no encontrado' });
      return;
    }

    res.json({
      success: true,
      data: evento
    });
  } catch (error) {
    console.error('❌ Error al obtener evento:', error);
    res.status(500).json({ error: 'Error al obtener evento' });
  }
};

// ── CREAR EVENTO (ADMIN) ───────────────────────────────────────────
export const createEventoController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.rol !== 'ADMIN') {
      res.status(403).json({ error: 'Acceso denegado' });
      return;
    }

    const eventoData = req.body;

    const evento = await createEvento(eventoData);

    res.status(201).json({
      success: true,
      message: 'Evento creado exitosamente',
      data: evento
    });
  } catch (error) {
    console.error('❌ Error al crear evento:', error);
    res.status(500).json({ error: 'Error al crear evento' });
  }
};

// ── ACTUALIZAR EVENTO (ADMIN) ────────────────────────────────────────
export const updateEventoController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.rol !== 'ADMIN') {
      res.status(403).json({ error: 'Acceso denegado' });
      return;
    }

    const { id } = req.params;
    const eventoData = req.body;

    const evento = await updateEvento(id, eventoData);

    if (!evento) {
      res.status(404).json({ error: 'Evento no encontrado' });
      return;
    }

    res.json({
      success: true,
      message: 'Evento actualizado exitosamente',
      data: evento
    });
  } catch (error) {
    console.error('❌ Error al actualizar evento:', error);
    res.status(500).json({ error: 'Error al actualizar evento' });
  }
};

// ── ELIMINAR EVENTO (ADMIN) ──────────────────────────────────────────
export const deleteEventoController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.rol !== 'ADMIN') {
      res.status(403).json({ error: 'Acceso denegado' });
      return;
    }

    const { id } = req.params;

    const eliminado = await deleteEvento(id);

    if (!eliminado) {
      res.status(404).json({ error: 'Evento no encontrado' });
      return;
    }

    res.json({
      success: true,
      message: 'Evento eliminado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error al eliminar evento:', error);
    res.status(500).json({ error: 'Error al eliminar evento' });
  }
};
