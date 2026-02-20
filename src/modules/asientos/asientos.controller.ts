import { Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { getAsientosPorEvento, getAsientoById, reservarAsiento, liberarAsiento } from './asientos.service';

interface AuthRequest extends Request {
  user?: { id: string; email: string; rol: string };
  io?: SocketIOServer;
}

// Mapa de errores del servicio → código HTTP + mensaje para el frontend
const errores: Record<string, { status: number; message: string }> = {
  ASIENTO_NO_ENCONTRADO:      { status: 404, message: 'Asiento no encontrado.' },
  ASIENTO_EVENTO_INVALIDO:    { status: 400, message: 'El asiento no pertenece a este evento.' },
  ASIENTO_NO_DISPONIBLE:      { status: 409, message: 'El asiento no está disponible.' },
  ASIENTO_EN_PROCESO:         { status: 409, message: 'El asiento está siendo reservado por otro usuario.' },
  ASIENTO_NO_RESERVADO:       { status: 400, message: 'El asiento no está reservado.' },
  NO_TIENES_PERMISO_LIBERAR:  { status: 403, message: 'No puedes liberar un asiento que no te pertenece.' },
  ERROR_ACTUALIZANDO_ASIENTO: { status: 500, message: 'Error interno al actualizar el asiento.' },
};

const handleError = (res: Response, err: unknown) => {
  const msg = err instanceof Error ? err.message : '';
  const mapped = errores[msg];
  if (mapped) return res.status(mapped.status).json({ ok: false, error: mapped.message });
  console.error('[Asientos]', err);
  return res.status(500).json({ ok: false, error: 'Error interno del servidor.' });
};

// GET /api/asientos/evento/:eventoId
// Llamar al montar el mapa de asientos — estado combina BD + Redis
export const getAsientosEvento = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const asientos = await getAsientosPorEvento(req.params.eventoId, req.user?.id);
    res.json({ ok: true, total: asientos.length, data: asientos });
  } catch (err) { handleError(res, err); }
};

// GET /api/asientos/:id
export const getAsiento = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const asiento = await getAsientoById(req.params.id, req.user?.id);
    if (!asiento) { res.status(404).json({ ok: false, error: 'Asiento no encontrado.' }); return; }
    res.json({ ok: true, data: asiento });
  } catch (err) { handleError(res, err); }
};

// POST /api/asientos/reservar — body: { asientoId, eventoId }
// Si OK: emite 'asiento:reservado' a todos en la sala del evento
export const reservar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { asientoId, eventoId } = req.body;
    const userId = req.user?.id;

    if (!asientoId || !eventoId) { res.status(400).json({ ok: false, error: 'asientoId y eventoId son requeridos.' }); return; }
    if (!userId) { res.status(401).json({ ok: false, error: 'No autenticado.' }); return; }

    const asiento = await reservarAsiento({ asientoId, eventoId, userId });

    req.io?.to(`evento:${eventoId}`).emit('asiento:reservado', {
      asientoId,
      estado: 'EN_PROCESO',
      ttlSegundos: 300,
    });

    res.json({ ok: true, mensaje: 'Tienes 5 minutos para completar el pago.', data: asiento });
  } catch (err) { handleError(res, err); }
};

// POST /api/asientos/liberar — body: { asientoId, eventoId }
// Si OK: emite 'asiento:liberado' a todos en la sala del evento
export const liberar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { asientoId, eventoId } = req.body;
    const userId = req.user?.id;

    if (!asientoId || !eventoId) { res.status(400).json({ ok: false, error: 'asientoId y eventoId son requeridos.' }); return; }
    if (!userId) { res.status(401).json({ ok: false, error: 'No autenticado.' }); return; }

    const asiento = await liberarAsiento({ asientoId, eventoId, userId });

    req.io?.to(`evento:${eventoId}`).emit('asiento:liberado', {
      asientoId,
      estado: 'DISPONIBLE',
    });

    res.json({ ok: true, mensaje: 'Asiento liberado correctamente.', data: asiento });
  } catch (err) { handleError(res, err); }
};