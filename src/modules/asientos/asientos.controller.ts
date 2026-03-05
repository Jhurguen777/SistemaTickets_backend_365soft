import { Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import {
  getAsientosPorEvento,
  getAsientoById,
  reservarAsiento,
  liberarAsiento,
  reservarVarios as reservarVariosService,
  liberarVarios as liberarVariosService,
  limpiarAsientosEvento
} from './asientos.service';

interface AuthRequest extends Request {
  user?: { id: string; email: string; isAdmin: boolean; tipoRol?: string };
  io?: SocketIOServer;
}

const errores: Record<string, { status: number; message: string }> = {
  ASIENTO_NO_ENCONTRADO:       { status: 404, message: 'Asiento no encontrado.' },
  ASIENTO_EVENTO_INVALIDO:     { status: 400, message: 'El asiento no pertenece a este evento.' },
  ASIENTO_NO_DISPONIBLE:       { status: 409, message: 'El asiento no está disponible.' },
  ASIENTO_EN_PROCESO:          { status: 409, message: 'El asiento está siendo reservado por otro usuario.' },
  ASIENTO_NO_RESERVADO:        { status: 400, message: 'El asiento no está reservado.' },
  NO_TIENES_PERMISO_LIBERAR:  { status: 403, message: 'No puedes liberar un asiento que no te pertenece.' },
  ERROR_ACTUALIZANDO_ASIENTO: { status: 500, message: 'Error interno al actualizar el asiento.' },
  EVENTO_NO_ENCONTRADO:         { status: 404, message: 'Evento no encontrado.' },
  ALGUNOS_ASIENTOS_NO_EXISTEN: { status: 400, message: 'Algunos asientos no existen en el evento.' },
  ASIENTOS_OCUPADOS:           { status: 409, message: 'Algunos asientos ya están ocupados por otros usuarios.' },
  ASIENTOS_NO_ENCONTRADOS:     { status: 404, message: 'Asientos no encontrados.' },
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
// PÚBLICO - no requiere autenticación
export const getAsientosEvento = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // ✅ Timeout de 8 segundos para evitar cuelgue si Redis no responde
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 8000)
    );

    const asientosPromise = getAsientosPorEvento(req.params.eventoId, req.user?.id);

    const asientos = await Promise.race([asientosPromise, timeoutPromise]);
    res.json({ ok: true, total: asientos.length, data: asientos });

  } catch (err) {
    const msg = err instanceof Error ? err.message : '';

    if (msg === 'TIMEOUT') {
      console.warn(`⚠️ Timeout obteniendo asientos del evento ${req.params.eventoId} — Redis puede estar caído`);
      // ✅ Fallback: devolver asientos desde BD directamente sin Redis
      try {
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        const asientos = await prisma.asiento.findMany({
          where: { eventoId: req.params.eventoId },
          orderBy: [{ fila: 'asc' }, { numero: 'asc' }],
          select: { id: true, fila: true, numero: true, precio: true, estado: true, eventoId: true }
        });
        await prisma.$disconnect();
        res.json({ ok: true, total: asientos.length, data: asientos });
      } catch (fallbackErr) {
        console.error('[Asientos fallback]', fallbackErr);
        res.status(500).json({ ok: false, error: 'Error al obtener asientos.' });
      }
      return;
    }

    handleError(res, err);
  }
};

// GET /api/asientos/:id — PÚBLICO
export const getAsiento = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const asiento = await getAsientoById(req.params.id, req.user?.id);
    if (!asiento) { res.status(404).json({ ok: false, error: 'Asiento no encontrado.' }); return; }
    res.json({ ok: true, data: asiento });
  } catch (err) { handleError(res, err); }
};

// POST /api/asientos/reservar — body: { asientoId, eventoId }
export const reservar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { asientoId, eventoId } = req.body;
    const userId = req.user?.id;

    if (!asientoId || !eventoId) { res.status(400).json({ ok: false, error: 'asientoId y eventoId son requeridos.' }); return; }
    if (!userId) { res.status(401).json({ ok: false, error: 'No autenticado.' }); return; }

    const asiento = await reservarAsiento({ asientoId, eventoId, userId });

    req.io?.to(`evento:${eventoId}`).emit('asiento:reservado', {
      asientoId,
      estado: 'RESERVANDO',
      ttlSegundos: 300,
    });

    res.json({ ok: true, mensaje: 'Tienes 5 minutos para completar el pago.', data: asiento });
  } catch (err) { handleError(res, err); }
};

// POST /api/asientos/liberar — body: { asientoId, eventoId }
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

// POST /api/asientos/reservar-varios — body: { asientosIds[], eventoId }
export const reservarVarios = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { asientosIds, eventoId } = req.body;
    const userId = req.user?.id;

    if (!asientosIds || !Array.isArray(asientosIds) || asientosIds.length === 0) {
      res.status(400).json({ ok: false, error: 'asientosIds es requerido y debe ser un array.' });
      return;
    }
    if (!eventoId) { res.status(400).json({ ok: false, error: 'eventoId es requerido.' }); return; }
    if (!userId) { res.status(401).json({ ok: false, error: 'No autenticado.' }); return; }

    if (asientosIds.length > 10) {
      res.status(400).json({ ok: false, error: 'Máximo 10 asientos por compra.' });
      return;
    }

    const resultado = await reservarVariosService({ asientosIds, eventoId, userId });

    // Emitir notificación a todos los clientes conectados al evento
    req.io?.to(`evento:${eventoId}`).emit('asiento:reservado', {
      asientosIds: resultado.asientos.map(a => a.id),
      estado: 'RESERVANDO',
    });

    res.json({
      ok: true,
      mensaje: resultado.message,
      total: resultado.asientos.length,
      data: resultado.asientos
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.startsWith('ASIENTOS_OCUPADOS:')) {
      const asientosOcupados = msg.split(':')[1];
      res.status(409).json({
        ok: false,
        error: errores.ASIENTOS_OCUPADOS.message,
        asientosOcupados
      });
      return;
    }
    handleError(res, err);
  }
};

// POST /api/asientos/liberar-varios — body: { asientosIds[], eventoId }
export const liberarVarios = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { asientosIds, eventoId } = req.body;
    const userId = req.user?.id;

    if (!asientosIds || !Array.isArray(asientosIds) || asientosIds.length === 0) {
      res.status(400).json({ ok: false, error: 'asientosIds es requerido y debe ser un array.' });
      return;
    }
    if (!eventoId) { res.status(400).json({ ok: false, error: 'eventoId es requerido.' }); return; }
    if (!userId) { res.status(401).json({ ok: false, error: 'No autenticado.' }); return; }

    await liberarVariosService({ asientosIds, eventoId, userId });

    // Emitir notificación a todos los clientes conectados al evento
    req.io?.to(`evento:${eventoId}`).emit('asiento:liberado', {
      asientosIds,
      estado: 'DISPONIBLE',
    });

    res.json({
      ok: true,
      mensaje: 'Asientos liberados correctamente.',
      total: asientosIds.length
    });
  } catch (err) { handleError(res, err); }
};

// POST /api/asientos/limpiar-evento/:eventoId - SOLO ADMIN
// Limpia asientos y Redis locks para un evento (útil para pruebas y mantenimiento)
export const limpiarEvento = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { eventoId } = req.params;
    const user = req.user;

    // Solo admin puede limpiar asientos
    if (!user?.isAdmin) {
      res.status(403).json({ ok: false, error: 'Solo administradores pueden limpiar asientos.' });
      return;
    }

    const resultado = await limpiarAsientosEvento(eventoId);

    // Emitir notificación para actualizar todos los clientes conectados
    req.io?.to(`evento:${eventoId}`).emit('asientos:refrescar', { eventoId });

    res.json({
      ok: true,
      mensaje: 'Asientos y locks limpiados correctamente.',
      ...resultado
    });
  } catch (err) {
    console.error('[Asientos limpiarEvento]', err);
    res.status(500).json({ ok: false, error: 'Error al limpiar asientos.' });
  }
};