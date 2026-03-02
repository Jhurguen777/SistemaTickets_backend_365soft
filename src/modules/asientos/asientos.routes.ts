import { Router, Request, Response, NextFunction } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { authenticate as authMiddleware } from '../../shared/middleware/auth';
import { getAsientosEvento, getAsiento, reservar, liberar } from './asientos.controller';

const injectIO = (io: SocketIOServer) =>
  (req: Request & { io?: SocketIOServer }, _res: Response, next: NextFunction) => {
    req.io = io;
    next();
  };

export const asientosRouter = (io: SocketIOServer): Router => {
  const router = Router();
  const withIO = injectIO(io);

  // Públicos (no requieren autenticación)
  router.get('/evento/:eventoId', getAsientosEvento); // ✅ Público - cualquiera puede ver asientos

  // Endpoints que requieren autenticación
  router.get('/:id',        authMiddleware, getAsiento);
  router.post('/reservar',  authMiddleware, withIO, reservar);
  router.post('/liberar',   authMiddleware, withIO, liberar);

  return router;
};

export default asientosRouter;
