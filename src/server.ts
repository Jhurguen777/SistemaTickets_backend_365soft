// src/server.ts
import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { createAdapter } from '@socket.io/redis-adapter';
import { redisClient, redisPub, redisSub } from './shared/config/redis';
import prisma from './shared/config/database';
import { setupSocketHandlers } from './sockets/seatSocket';
import passport from './modules/auth/passport.config';
import authRoutes from './modules/auth/auth.routes';
import eventoRoutes from './modules/eventos/eventos.routes';
import asientoRoutes from './modules/asientos/asientos.routes';
import compraRoutes from './modules/compras/compras.routes';
import asistenciaRoutes from './modules/asistencia/asistencia.routes';
import certificadoRoutes from './modules/certificados/certificados.routes';
import adminRoutes from './modules/admin/admin.routes';
import qrPagosRoutes from './modules/compras/qr-pagos.routes';
import comprasService from './modules/compras/compras.service';

dotenv.config();

// ── VALIDACIÓN DE ENTORNO (fail-fast) ────────────────────────────────────
const REQUIRED_ENV = [
  'JWT_SECRET',
  'DATABASE_URL',
  'REDIS_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
  'BANCO_QR_API_URL',
  'BANCO_QR_API_KEY',
  'BANCO_QR_SERVICE_KEY',
  'BANCO_QR_USERNAME',
  'BANCO_QR_PASSWORD',
] as const;

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ Variable de entorno requerida no definida: ${key}`);
    process.exit(1);
  }
}

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
if (process.env.REDIS_URL && redisPub.isReady && redisSub.isReady) {
  try {
    io.adapter(createAdapter(redisPub, redisSub));
    console.log('✅ Socket.IO Redis Adapter configurado');
  } catch (err) {
    console.warn('⚠️  Redis Adapter no pudo configurarse, usando modo local');
  }
} else {
  console.warn('⚠️  Redis no disponible — Socket.IO en modo local');
}

// ── MIDDLEWARES ───────────────────────────────────────────────
const corsOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_PROD_URL,
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : []),
].map(o => o?.trim()).filter(Boolean) as string[];

app.use(cors({
  origin: corsOrigins.length ? corsOrigins : 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
app.use('/api/asientos', asientoRoutes(io));
app.use('/api/compras', compraRoutes);
app.use('/api/compras/qr', qrPagosRoutes);
app.use('/api/asistencia', asistenciaRoutes);
app.use('/api/certificados', certificadoRoutes);
app.use('/api/admin', adminRoutes);

console.log('📋 Rutas montadas:');
console.log('  - POST /api/auth/* (Autenticación)');
console.log('  - GET/POST /api/eventos/* (Eventos)');
console.log('  - GET/POST /api/asientos/* (Asientos)');
console.log('  - GET/POST/DELETE /api/compras/* (Compras)');
console.log('  - GET/POST/DELETE /api/compras/qr/* (QR Pagos)');
console.log('  - GET/POST /api/asistencia/* (Asistencia)');
console.log('  - GET/POST /api/certificados/* (Certificados)');
console.log('  - GET/POST /api/admin/* (Admin)');

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

// ── CRON JOBS ────────────────────────────────────────────────

// Cron Job 1: Limpiar locks expirados de Redis (cada 5 minutos)
setInterval(async () => {
  try {
    const keys = await redisClient.keys('seat_lock:*');

    if (keys.length === 0) return;

    let liberados = 0;
    for (const key of keys) {
      try {
        const ttl = await redisClient.ttl(key);
        // Si TTL es -1 (no existe) o 0 (expirado), liberar el asiento en BD
        if (ttl === -1 || ttl === 0) {
          const partes = key.split(':');
          if (partes.length === 3) {
            const asientoId = partes[2];

            // Liberar asiento en BD
            await prisma.asiento.updateMany({
              where: {
                id: asientoId,
                estado: 'RESERVANDO',
                reservadoEn: { lte: new Date(Date.now() - 10 * 60 * 1000) } // Solo si expiró hace > 10 min
              },
              data: { estado: 'DISPONIBLE', reservadoEn: null }
            });

            // Eliminar lock de Redis
            await redisClient.del(key);
            liberados++;
          }
        }
      } catch (err) {
        console.warn('⚠️  Error procesando lock en cleanup:', err);
      }
    }

    if (liberados > 0) {
      console.log(`🧹 Cron: Liberados ${liberados} asientos con locks expirados`);
    }
  } catch (err) {
    console.error('❌ Error en cron job de locks:', err);
  }
}, 5 * 60 * 1000); // Cada 5 minutos

// Cron Job 2: Limpiar QRs vencidos (cada 5 minutos)
setInterval(async () => {
  try {
    const result = await comprasService.limpiarQrsVencidos();
    if (result && result.limpiados > 0) {
      console.log(`✅ Cron: ${result.limpiados} QRs vencidos limpiados`);
    }
  } catch (err) {
    console.error('❌ Error en cron job de QRs vencidos:', err);
  }
}, 5 * 60 * 1000); // Cada 5 minutos

// ── INICIO ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log('╔════════════════════════════════════╗');
  console.log('║  🚀 SISTEMA DE TICKETS - BACKEND        ║');
  console.log('╠════════════════════════════════════╣');
  console.log(`║  Puerto:   ${PORT}                        ║`);
  console.log(`║  Entorno:  ${process.env.NODE_ENV || 'development'}               ║`);
  console.log(`║  Redis:    ${redisStatus()}               ║`);
  console.log(`║  OAuth:    ✅ Google listo               ║`);
  console.log(`║  WS:       ✅ Socket.IO listo            ║`);
  console.log(`║  Cron:     ✅ Jobs activos              ║`);
  console.log('╚══════════════════════════════════════╝');
});

export { io };
