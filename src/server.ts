// src/server.ts
import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { createAdapter } from '@socket.io/redis-adapter';
import { redisClient, redisPub, redisSub } from './shared/config/redis';
import { setupSocketHandlers } from './sockets/seatSocket';
import passport from './modules/auth/passport.config';
import authRoutes from './modules/auth/auth.routes';
import eventoRoutes from './modules/eventos/eventos.routes';
import asientoRoutes from './modules/asientos/asientos.routes';
import compraRoutes from './modules/compras/compras.routes';
import asistenciaRoutes from './modules/asistencia/asistencia.routes';
import certificadoRoutes from './modules/certificados/certificados.routes';
import adminRoutes from './modules/admin/admin.routes';

dotenv.config();

const app: Express = express();
const httpServer = createServer(app);

// ⚡ Socket.IO con Redis Adapter
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Redis Adapter para escalabilidad horizontal
if (process.env.REDIS_URL) {
  io.adapter(createAdapter(redisPub, redisSub));
  console.log('✅ Socket.IO Redis Adapter configurado');
}

// ── MIDDLEWARES ───────────────────────────────────────────────
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    process.env.FRONTEND_PROD_URL || ''
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Passport sin sesiones (usamos JWT)
app.use(passport.initialize());

// ── HEALTH CHECK ─────────────────────────────────────────────
const redisStatus = () => redisClient.isReady ? 'conectado' : 'desconectado';

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    redis: redisStatus(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// ── API ROUTES ────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/eventos', eventoRoutes);
app.use('/api/asientos', asientoRoutes);
app.use('/api/compras', compraRoutes);
app.use('/api/asistencia', asistenciaRoutes);
app.use('/api/certificados', certificadoRoutes);
app.use('/api/admin', adminRoutes);

// ── WEBSOCKETS ────────────────────────────────────────────────
setupSocketHandlers(io);

// ── ERROR HANDLER ─────────────────────────────────────────────
app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ── 404 ───────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ── INICIO ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  🚀 SISTEMA DE TICKETS - BACKEND        ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Puerto:   ${PORT}                        ║`);
  console.log(`║  Entorno:  ${process.env.NODE_ENV || 'development'}               ║`);
  console.log(`║  Redis:    ${redisStatus()}               ║`);
  console.log(`║  OAuth:    ✅ Google listo               ║`);
  console.log(`║  WS:       ✅ Socket.IO listo            ║`);
  console.log('╚══════════════════════════════════════════╝');
});

export { io };