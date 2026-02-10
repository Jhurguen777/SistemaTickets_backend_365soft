# 🎫 Sistema de Tickets - Backend

Backend para sistema de venta de tickets con certificados personalizados, tiempo real con Socket.IO y Redis.

## 🚀 Stack Tecnológico

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Lenguaje**: TypeScript
- **WebSocket**: Socket.IO con Redis Adapter
- **Database**: PostgreSQL con Prisma ORM
- **Cache**: Redis (locks + pub/sub)
- **Auth**: JWT + Google OAuth
- **Pagos**: Stripe

## 📋 Requisitos Previos

- Node.js 20+
- PostgreSQL 14+
- Redis 7+ (o cuenta de Upstash)

## 🔧 Instalación

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env

# Editar .env con tus credenciales
# - DATABASE_URL
# - REDIS_URL
# - JWT_SECRET
# - GOOGLE_CLIENT_ID
# - GOOGLE_CLIENT_SECRET
# - STRIPE_SECRET_KEY
# - RESEND_API_KEY
```

## 🗄️ Configurar Base de Datos

```bash
# Generar Prisma Client
npm run prisma:generate

# Ejecutar migraciones
npm run prisma:migrate

# (Opcional) Abrir Prisma Studio
npm run prisma:studio
```

## 🎯 Modos de Ejecución

### Desarrollo

```bash
npm run dev
```

El servidor arrancará en `http://localhost:3000`

### Producción

```bash
# Build
npm run build

# Start
npm start
```

## 📁 Estructura del Proyecto

```
src/
├── modules/           # Módulos de negocio (monolito modular)
│   ├── auth/          # Autenticación
│   ├── eventos/       # Gestión de eventos
│   ├── asientos/      # Sistema de asientos
│   ├── compras/       # Procesamiento de compras
│   ├── asistencia/    # Control de asistencia
│   ├── certificados/  # Generación de certificados
│   └── admin/         # Panel de administración
├── sockets/           # Socket.IO handlers
├── shared/
│   ├── config/        # Configuración (DB, Redis)
│   ├── middleware/    # Middleware de autenticación
│   └── utils/         # Utilidades (JWT, QR)
└── server.ts          # Entry point
```

## 🔌 API Endpoints

### Autenticación
- `POST /api/auth/register` - Registro con Google OAuth
- `POST /api/auth/login` - Login con Google OAuth
- `GET /api/auth/me` - Obtener usuario actual

### Eventos
- `GET /api/eventos` - Listar eventos
- `GET /api/eventos/:id` - Detalle de evento
- `POST /api/eventos` - Crear evento (admin)

### Compras
- `POST /api/compras/crear` - Crear compra (Stripe)
- `GET /api/compras/usuario` - Mis compras
- `POST /api/compras/:id/reembolsar` - Reembolsar

### Admin
- `GET /api/admin/dashboard` - Métricas generales
- `GET /api/admin/reports/ventas` - Reporte de ventas
- `GET /api/admin/reports/asistencia` - Reporte de asistencia

## 🔌 WebSocket Events

### Cliente → Servidor
- `join_evento` - Unirse a evento
- `reservar_asiento` - Reservar asiento
- `leave_evento` - Abandonar evento

### Servidor → Cliente
- `asientos_estado` - Estado inicial de asientos
- `asiento_reservado` - Asiento reservado por otro usuario
- `asiento_liberado` - Asiento liberado
- `reserva_exitosa` - Reserva exitosa
- `reserva_fallida` - Reserva fallida

## 🚀 Deploy en Railway

```bash
# Instalar CLI de Railway
npm install -g @railway/cli

# Login
railway login

# Inicializar proyecto
railway init

# Agregar PostgreSQL
railway add postgresql

# Agregar Redis (opcional, mejor usar Upstash)
railway add redis

# Deploy
railway up
```

## 🔗 Variables de Entorno (Producción)

```bash
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
FRONTEND_URL=https://tu-frontend.vercel.app
JWT_SECRET=tu_secreto_super_seguro
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
STRIPE_SECRET_KEY=sk_live_...
RESEND_API_KEY=re_...
```

## 📚 Recursos

- [Express.js](https://expressjs.com/)
- [Socket.IO](https://socket.io/)
- [Prisma](https://www.prisma.io/)
- [Railway](https://railway.app/)
- [Upstash Redis](https://upstash.com/)

## 👨‍💻 Autor

365soft

## 📄 Licencia

MIT