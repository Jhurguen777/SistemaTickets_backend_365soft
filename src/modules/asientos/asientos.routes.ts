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

  // ✅ GET público — no requiere JWT para ver disponibilidad
  router.get('/evento/:eventoId', getAsientosEvento);
  router.get('/:id', getAsiento);

  // ✅ POST sí requieren autenticación
  router.post('/reservar', authMiddleware, withIO, reservar);
  router.post('/liberar',  authMiddleware, withIO, liberar);

  return router;
};

export default asientosRouter;