import { Server, Socket } from 'socket.io';
import prisma from '../shared/config/database';
import { sincronizarAsientosExpirados } from '../modules/asientos/asientos.service';

interface ReservarAsientoPayload {
  eventoId: string;
  asientoId: string;
  userId: string;
}

const TIEMPO_RESERVA_MS = 10 * 60 * 1000;

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
        socket.emit('asientos_estado', { asientos });
      } catch {
        socket.emit('error', { message: 'No se pudo obtener el estado de los asientos' });
      }
    });

    // ── LEAVE EVENTO ────────────────────────────────────────
    socket.on('leave_evento', (eventoId: string) => {
      socket.leave(`evento_${eventoId}`);
    });

    // ── RESERVAR ASIENTO ────────────────────────────────────
    socket.on('reservar_asiento', async (data: ReservarAsientoPayload) => {
      const { eventoId, asientoId, userId } = data;

      try {
        const asiento = await prisma.asiento.findUnique({ where: { id: asientoId } });

        if (!asiento) {
          socket.emit('reserva_fallida', { error: 'Asiento no encontrado' });
          return;
        }

        if (asiento.estado === 'VENDIDO' || asiento.estado === 'BLOQUEADO') {
          socket.emit('reserva_fallida', { error: 'El asiento no está disponible' });
          return;
        }

        if (asiento.estado === 'RESERVANDO' && asiento.reservadoEn) {
          const tiempoTranscurrido = Date.now() - asiento.reservadoEn.getTime();
          if (tiempoTranscurrido < TIEMPO_RESERVA_MS) {
            socket.emit('reserva_fallida', { error: 'El asiento está siendo reservado por otro usuario' });
            return;
          }
        }

        await prisma.asiento.update({
          where: { id: asientoId },
          data: { estado: 'RESERVANDO', reservadoEn: new Date() },
        });

        const compra = await prisma.compra.create({
          data: {
            usuarioId: userId,
            eventoId,
            asientoId,
            monto: 0,
            qrCode: `QR-${asientoId}-${userId}-${Date.now()}`,
          },
          include: {
            asiento: { select: { fila: true, numero: true } },
            evento:  { select: { titulo: true, precio: true } },
          },
        });

        socket.emit('reserva_exitosa', {
          compraId: compra.id,
          asientoId,
          fila: compra.asiento.fila,
          numero: compra.asiento.numero,
          evento: compra.evento.titulo,
          precio: compra.evento.precio,
          expiraEn: TIEMPO_RESERVA_MS / 1000,
        });

        // Notificar a todos en la sala
        io.to(`evento_${eventoId}`).emit('asiento_actualizado', {
          asientoId,
          estado: 'RESERVANDO',
        });

      } catch {
        socket.emit('reserva_fallida', { error: 'Error interno al reservar el asiento' });
      }
    });

    // ── SINCRONIZAR EXPIRADOS (admin) ───────────────────────
    socket.on('asiento:sincronizar', async ({ eventoId }: { eventoId: string }) => {
      try {
        const liberados = await sincronizarAsientosExpirados(eventoId);
        if (liberados > 0) {
          io.to(`evento_${eventoId}`).emit('asiento_actualizado', {
            tipo: 'expirados',
            cantidad: liberados,
          });
        }
        socket.emit('asiento:sincronizar-ok', { eventoId, liberados });
      } catch {
        socket.emit('error', { mensaje: 'Error al sincronizar asientos.' });
      }
    });

    // ── DISCONNECT ──────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`❌ Cliente desconectado: ${socket.id}`);
      // TODO: liberar reservas RESERVANDO del socket desconectado
    });
  });
}