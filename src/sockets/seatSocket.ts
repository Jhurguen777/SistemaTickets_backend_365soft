import { Server, Socket } from 'socket.io';
import prisma from '../shared/config/database';
import { sincronizarAsientosExpirados } from '../modules/asientos/asientos.service';

// Helper para emitir sin crashear si Redis no esta disponible
const safeEmit = (target: any, event: string, data: any) => {
  try {
    target.emit(event, data);
  } catch (err) {
    console.warn(`⚠️ Socket emit falló (${event}):`, err);
  }
};

/**
 * CONFIGURA LOS HANDLERS DE SOCKET.IO
 * SOLO PARA BROADCASTS DE NOTIFICACIONES
 * Las reservas se hacen via HTTP API
 */
export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`✅ Cliente conectado: ${socket.id}`);

    // ── JOIN EVENTO ─────────────────────────────────────────
    // Cliente se une a la sala del evento para recibir actualizaciones
    socket.on('join_evento', (eventoId: string) => {
      socket.join(`evento:${eventoId}`);
      console.log(`👤 Cliente ${socket.id} se unió al evento ${eventoId}`);

      // Enviar estado inicial de asientos a este cliente
      (async () => {
        try {
          const asientos = await prisma.asiento.findMany({
            where: { eventoId },
            select: { id: true, fila: true, numero: true, estado: true, reservadoEn: true },
            orderBy: [{ fila: 'asc' }, { numero: 'asc' }],
          });

          safeEmit(socket, 'asientos_estado', {
            eventoId,
            asientos
          });
        } catch (err) {
          console.error('❌ Error obteniendo asientos:', err);
          safeEmit(socket, 'error', { message: 'No se pudo obtener el estado de los asientos' });
        }
      })();
    });

    // ── LEAVE EVENTO ────────────────────────────────────────
    socket.on('leave_evento', (eventoId: string) => {
      socket.leave(`evento:${eventoId}`);
      console.log(`👤 Cliente ${socket.id} salió del evento ${eventoId}`);
    });

    // ── SINCRONIZAR EXPIRADOS (admin) ────────────────
    // Permite a un admin forzar la sincronización de asientos expirados
    socket.on('asiento:sincronizar', async ({ eventoId }: { eventoId: string }) => {
      try {
        const liberados = await sincronizarAsientosExpirados(eventoId);
        if (liberados > 0) {
          safeEmit(io.to(`evento:${eventoId}`), 'asiento:sincronizar-ok', {
            tipo: 'expirados',
            cantidad: liberados,
            eventoId
          });
        }
        safeEmit(socket, 'asiento:sincronizar-ok', { eventoId, liberados });
      } catch {
        safeEmit(socket, 'error', { message: 'Error al sincronizar asientos expirados.' });
      }
    });

    // ── DISCONNECT ──────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`❌ Cliente desconectado: ${socket.id}`);
    });
  });
}
