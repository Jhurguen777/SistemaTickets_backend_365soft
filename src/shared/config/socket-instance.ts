// src/shared/config/socket-instance.ts
// Módulo compartido para acceder a la instancia io de Socket.IO
// sin crear dependencias circulares entre server.ts y los servicios.
import { Server } from 'socket.io';

let _io: Server | null = null;

/**
 * Registra la instancia global de Socket.IO.
 * Llamar desde server.ts justo después de crear `io`.
 */
export function setIo(io: Server): void {
  _io = io;
}

/**
 * Devuelve la instancia de Socket.IO o null si aún no se ha registrado.
 */
export function getIo(): Server | null {
  return _io;
}
