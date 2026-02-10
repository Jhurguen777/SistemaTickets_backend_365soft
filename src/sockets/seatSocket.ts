// src/sockets/seatSocket.ts
import { Server, Socket } from 'socket.io';
import prisma from '../shared/config/database';

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`✅ Cliente conectado: ${socket.id}`);

    // Usuario entra a un evento
    socket.on('join_evento', async (eventoId: string) => {
      socket.join(`evento_${eventoId}`);
      console.log(`Usuario ${socket.id} se unió al evento ${eventoId}`);

      // TODO: Enviar estado actual de asientos desde Redis cache
      socket.emit('asientos_estado', {
        message: 'Estado de asientos - Implementar con Redis'
      });
    });

    // Usuario intenta reservar un asiento
    socket.on('reservar_asiento', async (data: {
      eventoId: string;
      asientoId: string;
      userId: string;
    }) => {
      const { eventoId, asientoId, userId } = data;

      try {
        // TODO: Implementar lógica con Redis locks
        // 1. Adquirir lock distribuido
        // 2. Verificar disponibilidad en cache
        // 3. Marcar como RESERVANDO
        // 4. Actualizar PostgreSQL
        // 5. Broadcast a todos los usuarios

        socket.emit('reserva_exitosa', {
          asientoId,
          message: 'Asiento reservado temporalmente'
        });

        io.to(`evento_${eventoId}`).emit('asiento_reservado', {
          asientoId,
          estado: 'RESERVANDO'
        });
      } catch (error) {
        socket.emit('reserva_fallida', {
          error: 'Error al reservar asiento'
        });
      }
    });

    // Usuario abandona el evento
    socket.on('leave_evento', (eventoId: string) => {
      socket.leave(`evento_${eventoId}`);
      console.log(`Usuario ${socket.id} abandonó el evento ${eventoId}`);
    });

    // Desconexión
    socket.on('disconnect', () => {
      console.log(`❌ Cliente desconectado: ${socket.id}`);
      // TODO: Cleanup: liberar locks del usuario
    });
  });
}
