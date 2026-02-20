import { Router, Request, Response, NextFunction } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { authenticate as authMiddleware } from '../../shared/middleware/auth'; // ← alias
import { getAsientosEvento, getAsiento, reservar, liberar } from './asientos.controller';

// Inyecta la instancia de io en req para que los controllers puedan emitir eventos
const injectIO = (io: SocketIOServer) =>
  (req: Request & { io?: SocketIOServer }, _res: Response, next: NextFunction) => {
    req.io = io;
    next();
  };

// Uso en server.ts: app.use('/api/asientos', asientosRouter(io))
export const asientosRouter = (io: SocketIOServer): Router => {
  const router = Router();
  const withIO = injectIO(io);

  // Todos los endpoints requieren JWT: Authorization: Bearer <token>
  router.get('/evento/:eventoId', authMiddleware, getAsientosEvento);
  router.get('/:id',              authMiddleware, getAsiento);
  router.post('/reservar',        authMiddleware, withIO, reservar);
  router.post('/liberar',         authMiddleware, withIO, liberar);

  return router;
};

export default asientosRouter;