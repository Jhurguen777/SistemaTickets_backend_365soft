import { Server, Socket } from 'socket.io';
import prisma from '../shared/config/database';
import { sincronizarAsientosExpirados } from '../modules/asientos/asientos.service';

interface ReservarAsientoPayload {
  eventoId: string;
  asientoId: string;
  userId: string;
}

const TIEMPO_RESERVA_MS = 10 * 60 * 1000;

// Helper para emitir sin crashear si Redis no está disponible
const safeEmit = (target: any, event: string, data: any) => {
  try {
    target.emit(event, data);
  } catch (err) {
    console.warn(`⚠️ Socket emit falló (${event}):`, err);
  }
};

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`✅ Cliente conectado: ${socket.id}`);

    // ── JOIN EVENTO ─────────────────────────────────────────
    socket.on('join_evento', async (eventoId: string) => {
      socket.join(`evento_${eventoId}`);

      try {
        const asientos = await prisma.asiento.findMany({
          where: { eventoId },
          select: { id: true, fila: true, numero: true, estado: true, reservadoEn: true },
          orderBy: [{ fila: 'asc' }, { numero: 'asc' }],
        });
        safeEmit(socket, 'asientos_estado', { asientos });
      } catch {
        safeEmit(socket, 'error', { message: 'No se pudo obtener el estado de los asientos' });
      }
    });

    // ── LEAVE EVENTO ────────────────────────────────────────
    socket.on('leave_evento', (eventoId: string) => {
      socket.leave(`evento_${eventoId}`);
    });

    // ── RESERVAR ASIENTO ────────────────────────────────────
    socket.on('reservar_asiento', async (data: ReservarAsientoPayload) => {
      const { eventoId, asientoId } = data;

      try {
        const asiento = await prisma.asiento.findUnique({ where: { id: asientoId } });

        if (!asiento) {
          safeEmit(socket, 'reserva_fallida', { error: 'Asiento no encontrado' });
          return;
        }

        if (asiento.estado === 'VENDIDO' || asiento.estado === 'BLOQUEADO') {
          safeEmit(socket, 'reserva_fallida', { error: 'El asiento no está disponible' });
          return;
        }

        if (asiento.estado === 'RESERVANDO' && asiento.reservadoEn) {
          const tiempoTranscurrido = Date.now() - asiento.reservadoEn.getTime();
          if (tiempoTranscurrido < TIEMPO_RESERVA_MS) {
            safeEmit(socket, 'reserva_fallida', { error: 'El asiento está siendo reservado por otro usuario' });
            return;
          }
        }

        await prisma.asiento.update({
          where: { id: asientoId },
          data: { estado: 'RESERVANDO', reservadoEn: new Date() },
        });

        // ✅ Ya no creamos compra aquí - eso lo hace el endpoint /api/compras/iniciar-pago
        // Solo emitimos confirmación al cliente
        safeEmit(socket, 'reserva_exitosa', {
          asientoId,
          eventoId,
          expiraEn: TIEMPO_RESERVA_MS / 1000,
          mensaje: 'Asiento reservado. Procede al pago para completar la compra.'
        });

        // ✅ Notificar a todos en la sala con safeEmit para evitar crash si Redis no está
        safeEmit(io.to(`evento_${eventoId}`), 'asiento_actualizado', {
          asientoId,
          estado: 'RESERVANDO',
        });

      } catch (err) {
        console.error('❌ Error en reservar_asiento:', err);
        safeEmit(socket, 'reserva_fallida', { error: 'Error interno al reservar el asiento' });
      }
    });

    // ── SINCRONIZAR EXPIRADOS (admin) ───────────────────────
    socket.on('asiento:sincronizar', async ({ eventoId }: { eventoId: string }) => {
      try {
        const liberados = await sincronizarAsientosExpirados(eventoId);
        if (liberados > 0) {
          safeEmit(io.to(`evento_${eventoId}`), 'asiento_actualizado', {
            tipo: 'expirados',
            cantidad: liberados,
          });
        }
        safeEmit(socket, 'asiento:sincronizar-ok', { eventoId, liberados });
      } catch {
        safeEmit(socket, 'error', { mensaje: 'Error al sincronizar asientos.' });
      }
    });

    // ── DISCONNECT ──────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`❌ Cliente desconectado: ${socket.id}`);
    });
  });
}