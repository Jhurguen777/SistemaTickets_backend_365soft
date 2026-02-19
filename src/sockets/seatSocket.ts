// src/sockets/seatSocket.ts
import { Server, Socket } from 'socket.io';
import prisma from '../shared/config/database';

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
      console.log(`Usuario ${socket.id} se unió al evento ${eventoId}`);

      try {
        const asientos = await prisma.asiento.findMany({
          where: { eventoId },
          select: {
            id: true,
            fila: true,
            numero: true,
            estado: true,       // ← era 'ocupado', ahora es 'estado'
            reservadoEn: true,
          },
          orderBy: [{ fila: 'asc' }, { numero: 'asc' }],
        });

        socket.emit('asientos_estado', { asientos });  // estado ya viene directo, no hace falta enriquecer
      } catch (error) {
        console.error('Error obteniendo asientos:', error);
        socket.emit('error', { message: 'No se pudo obtener el estado de los asientos' });
      }
    });

    // ── RESERVAR ASIENTO ────────────────────────────────────
    socket.on('reservar_asiento', async (data: ReservarAsientoPayload) => {
      const { eventoId, asientoId, userId } = data;

      try {
        const asiento = await prisma.asiento.findUnique({
          where: { id: asientoId },
        });

        if (!asiento) {
          socket.emit('reserva_fallida', { error: 'Asiento no encontrado' });
          return;
        }

        // Verificar estado con el enum real del schema
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
          // Reserva vencida → se puede tomar
        }

        // Marcar como RESERVANDO
        await prisma.asiento.update({
          where: { id: asientoId },
          data: {
            estado: 'RESERVANDO',      // ← usa el enum, no boolean
            reservadoEn: new Date(),
          },
        });

        // Crear Compra PENDIENTE
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
            evento: { select: { titulo: true, precio: true } },
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
          message: 'Asiento reservado — tienes 10 minutos para completar el pago',
        });

        io.to(`evento_${eventoId}`).emit('asiento_actualizado', {
          asientoId,
          estado: 'RESERVANDO',
        });

      } catch (error) {
        console.error('Error reservando asiento:', error);
        socket.emit('reserva_fallida', { error: 'Error interno al reservar el asiento' });
      }
    });

    // ── LEAVE EVENTO ────────────────────────────────────────
    socket.on('leave_evento', (eventoId: string) => {
      socket.leave(`evento_${eventoId}`);
      console.log(`Usuario ${socket.id} abandonó el evento ${eventoId}`);
    });

    // ── DISCONNECT ──────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`❌ Cliente desconectado: ${socket.id}`);
      // TODO: liberar reservas RESERVANDO del socket desconectado
    });
  });
}