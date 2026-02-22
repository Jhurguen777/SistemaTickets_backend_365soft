# Documentación - Sistema de Eventos (Backend)

## 📋 Tabla de Contenidos

1. [Overview](#overview)
2. [Estructura del Proyecto](#estructura-del-proyecto)
3. [Base de Datos](#base-de-datos)
4. [API Endpoints](#api-endpoints)
5. [Servicios](#servicios)
6. [Configuración de Mapa de Asientos](#configuración-de-mapa-de-asientos)
7. [Autenticación y Autorización](#autenticación-y-autorización)
8. [WebSocket](#websocket)
9. [Errores Comunes](#errores-comunes)

---

## Overview

El backend del sistema de eventos está construido con **NestJS** y **Prisma ORM**. Proporciona APIs para:

- ✅ Gestión de eventos (CRUD)
- ✅ Configuración de mapas de asientos
- ✅ Gestión de sectores
- ✅ Autenticación y autorización
- ✅ WebSocket para tiempo real

### Stack Tecnológico
- **Framework:** NestJS
- **ORM:** Prisma
- **Base de Datos:** PostgreSQL (puede variar)
- **Validación:** class-validator
- **Autenticación:** JWT

---

## Estructura del Proyecto

```
backend/
├── src/
│   ├── modules/
│   │   ├── eventos/
│   │   │   ├── eventos.controller.ts      # Endpoints HTTP
│   │   │   ├── eventos.service.ts         # Lógica de negocio
│   │   │   ├── eventos.routes.ts          # Rutas
│   │   │   └── dto/
│   │   │       ├── create-evento.dto.ts   # DTOs de validación
│   │   │       └── update-evento.dto.ts
│   │   ├── admin/
│   │   │   ├── admin.controller.ts        # Endpoints admin
│   │   │   ├── admin.service.ts           # Lógica admin
│   │   │   └── admin.routes.ts
│   │   └── auth/
│   │       ├── auth.controller.ts         # Login/Register
│   │       ├── auth.service.ts
│   │       └── auth.routes.ts
│   ├── prisma/
│   │   └── prisma.service.ts              # Cliente Prisma
│   └── main.ts                             # Punto de entrada
├── prisma/
│   ├── schema.prisma                       # Esquema de BD
│   └── migrations/                         # Migraciones
└── .env                                    # Variables de entorno
```

---

## Base de Datos

### Modelo Prisma

```prisma
model Evento {
  id              String   @id @default(uuid())
  titulo          String
  descripcion     String?
  imagenUrl       String?
  fecha           DateTime
  hora            String
  doorsOpen       String?
  ubicacion       String
  direccion       String?
  capacidad       Int
  precio          Float
  categoria       String?
  subcategoria    String?
  organizer       String?
  estado          String   @default("activo")
  seatMapConfig   Json?    // Configuración del mapa de asientos
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  sectores        Sector[]
}

model Sector {
  id          String   @id @default(uuid())
  nombre      String
  precio      Float
  disponible  Int
  total       Int
  eventoId    String
  evento      Evento   @relation(fields: [eventoId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([eventoId])
}
```

### Campo seatMapConfig

Este campo almacena la configuración del mapa de asientos en formato JSON:

```json
{
  "sectors": [
    {
      "id": "sector-1",
      "name": "General",
      "color": "#10B981",
      "price": 150
    },
    {
      "id": "sector-2",
      "name": "VIP",
      "color": "#FFD700",
      "price": 300
    }
  ],
  "rows": [
    {
      "id": "row-a",
      "name": "A",
      "seats": 20,
      "columns": 2,
      "order": 1,
      "sectorId": "sector-1"
    }
  ],
  "specialSeats": [
    {
      "rowId": "row-a",
      "seatIndex": 0,
      "sectorName": "VIP",
      "color": "#FFD700",
      "price": 300
    }
  ]
}
```

---

## API Endpoints

### Base URL
```
http://localhost:3000/api
```

---

### 1. Obtener Todos los Eventos
```
GET /eventos
```

**Query Params (opcionales):**
```typescript
{
  page?: number      // Paginación
  limit?: number     // Resultados por página
  categoria?: string // Filtrar por categoría
  estado?: string    // Filtrar por estado
}
```

**Response (200):**
```json
{
  "data": {
    "eventos": [
      {
        "id": "uuid-123",
        "titulo": "Vibra Carnavalera 2026",
        "descripcion": "Descripción corta",
        "imagenUrl": "/media/banners/evento.jpg",
        "fecha": "2026-02-20T00:00:00.000Z",
        "hora": "20:00",
        "ubicacion": "Estadio Olímpico",
        "precio": 150,
        "categoria": "Fiestas",
        "estado": "activo"
      }
    ],
    "total": 10,
    "page": 1,
    "limit": 10
  }
}
```

---

### 2. Obtener Evento por ID
```
GET /eventos/:id
```

**Response (200):**
```json
{
  "data": {
    "id": "uuid-123",
    "titulo": "Vibra Carnavalera 2026",
    "descripcion": "Descripción completa",
    "imagenUrl": "/media/banners/evento.jpg",
    "fecha": "2026-02-20T00:00:00.000Z",
    "hora": "20:00",
    "doorsOpen": "19:00",
    "ubicacion": "Estadio Olímpico",
    "direccion": "Av. Principal 123",
    "capacidad": 5000,
    "precio": 150,
    "categoria": "Fiestas",
    "subcategoria": "Carnaval",
    "organizer": "365soft Eventos",
    "estado": "activo",
    "seatMapConfig": {
      "sectors": [...],
      "rows": [...],
      "specialSeats": [...]
    },
    "sectores": [
      {
        "id": "sector-uuid",
        "nombre": "General",
        "precio": 150,
        "disponible": 4500,
        "total": 5000
      }
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

---

### 3. Crear Evento (Admin)
```
POST /admin/eventos
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "titulo": "Vibra Carnavalera 2026",
  "descripcion": "Descripción del evento",
  "imagenUrl": "/media/banners/evento.jpg",
  "fecha": "2026-02-20",
  "hora": "20:00",
  "ubicacion": "Estadio Olímpico",
  "capacidad": 5000,
  "precio": 150,
  "categoria": "Fiestas",
  "estado": "activo",
  "seatMapConfig": {
    "sectors": [...],
    "rows": [...],
    "specialSeats": [...]
  },
  "sectores": [
    {
      "nombre": "General",
      "precio": 150,
      "total": 5000
    }
  ]
}
```

**Response (201):**
```json
{
  "message": "Evento creado exitosamente",
  "data": {
    "id": "uuid-123",
    "titulo": "Vibra Carnavalera 2026",
    ...
  }
}
```

---

### 4. Actualizar Evento (Admin)
```
PATCH /admin/eventos/:id
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:** (Mismo que crear, todos los campos opcionales)

**Response (200):**
```json
{
  "message": "Evento actualizado exitosamente",
  "data": { ... }
}
```

---

### 5. Eliminar Evento (Admin)
```
DELETE /admin/eventos/:id
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "message": "Evento eliminado exitosamente"
}
```

---

## Servicios

### EventosService

**Ubicación:** `src/modules/eventos/eventos.service.ts`

#### Métodos Principales:

##### 1. createEvento
```typescript
async createEvento(data: CreateEventoDto) {
  const evento = await this.prisma.evento.create({
    data: {
      titulo: data.titulo,
      descripcion: data.descripcion,
      imagenUrl: data.imagenUrl,
      fecha: new Date(data.fecha),
      hora: data.hora,
      ubicacion: data.ubicacion,
      capacidad: data.capacidad,
      precio: data.precio,
      categoria: data.categoria,
      estado: data.estado,
      seatMapConfig: data.seatMapConfig || null,
      sectores: data.sectores ? {
        create: data.sectores.map(sector => ({
          nombre: sector.nombre,
          precio: sector.precio,
          disponible: sector.total,
          total: sector.total
        }))
      } : undefined
    },
    include: {
      sectores: true
    }
  })

  return evento
}
```

##### 2. getEventoById
```typescript
async getEventoById(id: string) {
  const evento = await this.prisma.evento.findUnique({
    where: { id },
    include: {
      sectores: true
    }
  })

  if (!evento) {
    throw new NotFoundException('Evento no encontrado')
  }

  return evento
}
```

##### 3. getEventos
```typescript
async getEventos(params: GetEventosDto) {
  const { page = 1, limit = 10, categoria, estado } = params

  const where = {
    ...(categoria && { categoria }),
    ...(estado && { estado })
  }

  const [eventos, total] = await Promise.all([
    this.prisma.evento.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { fecha: 'asc' }
    }),
    this.prisma.evento.count({ where })
  ])

  return {
    eventos,
    total,
    page,
    limit
  }
}
```

##### 4. updateEvento
```typescript
async updateEvento(id: string, data: UpdateEventoDto) {
  // Verificar que existe
  await this.getEventoById(id)

  // Actualizar sectores si se proporcionan
  let sectoresUpdate = undefined
  if (data.sectores) {
    // Eliminar sectores existentes
    await this.prisma.sector.deleteMany({
      where: { eventoId: id }
    })

    // Crear nuevos sectores
    sectoresUpdate = {
      create: data.sectores.map(sector => ({
        nombre: sector.nombre,
        precio: sector.precio,
        disponible: sector.total,
        total: sector.total
      }))
    }
  }

  // Actualizar evento
  const evento = await this.prisma.evento.update({
    where: { id },
    data: {
      ...(data.titulo && { titulo: data.titulo }),
      ...(data.descripcion && { descripcion: data.descripcion }),
      ...(data.imagenUrl && { imagenUrl: data.imagenUrl }),
      ...(data.fecha && { fecha: new Date(data.fecha) }),
      ...(data.hora && { hora: data.hora }),
      ...(data.ubicacion && { ubicacion: data.ubicacion }),
      ...(data.capacidad && { capacidad: data.capacidad }),
      ...(data.precio && { precio: data.precio }),
      ...(data.categoria && { categoria: data.categoria }),
      ...(data.estado && { estado: data.estado }),
      ...(data.seatMapConfig && { seatMapConfig: data.seatMapConfig }),
      sectores: sectoresUpdate
    },
    include: {
      sectores: true
    }
  })

  return evento
}
```

---

## Configuración de Mapa de Asientos

### Estructura JSON

El mapa de asientos se guarda en el campo `seatMapConfig` (tipo JSON) de la tabla `Evento`.

```typescript
interface SeatMapConfig {
  sectors?: SectorConfig[]    // Sectores confirmados
  rows?: RowConfig[]          // Filas de asientos
  specialSeats?: SpecialSeatConfig[]  // Asientos personalizados
}

interface SectorConfig {
  id: string          // ID único del sector
  name: string        // Nombre (General, VIP, etc.)
  color: string       // Color hexadecimal (#RRGGBB)
  price: number       // Precio del sector
}

interface RowConfig {
  id: string          // ID único de la fila
  name: string        // Nombre de fila (A, B, C, etc.)
  seats: number       // Cantidad de asientos
  columns: number     // Cantidad de columnas (para pasillos)
  order: number       // Orden de la fila (1 = primera)
  sectorId?: string   // ID del sector que aplica (opcional)
}

interface SpecialSeatConfig {
  rowId: string       // ID de la fila
  seatIndex: number   // Índice del asiento (0-based)
  sectorName?: string // Nombre del sector (VIP, Platea, etc.)
  color?: string      // Color hexadecimal
  price?: number      // Precio personalizado
}
```

### Ejemplo Completo

```json
{
  "sectors": [
    {
      "id": "sector-general",
      "name": "General",
      "color": "#10B981",
      "price": 150
    },
    {
      "id": "sector-vip",
      "name": "VIP",
      "color": "#FFD700",
      "price": 300
    }
  ],
  "rows": [
    {
      "id": "row-a",
      "name": "A",
      "seats": 20,
      "columns": 2,
      "order": 1,
      "sectorId": "sector-vip"
    },
    {
      "id": "row-b",
      "name": "B",
      "seats": 20,
      "columns": 2,
      "order": 2,
      "sectorId": "sector-general"
    }
  ],
  "specialSeats": [
    {
      "rowId": "row-b",
      "seatIndex": 5,
      "sectorName": "VIP",
      "color": "#FFD700",
      "price": 300
    }
  ]
}
```

Este ejemplo crea:
- **Fila A:** 20 asientos VIP (porque tiene `sectorId: "sector-vip"`)
- **Fila B:** 19 asientos General + 1 asiento VIP (el asiento índice 5)

---

## Autenticación y Autorización

### JWT (JSON Web Tokens)

Los endpoints de admin requieren autenticación mediante JWT.

#### Headers de Autenticación
```
Authorization: Bearer <token>
```

#### Guards de Autorización

```typescript
// Solo administradores
@UseGuards(JwtAuthGuard, AdminGuard)
@Post()
createEvento(@Body() data: CreateEventoDto) {
  return this.eventosService.createEvento(data)
}
```

#### Payload del Token
```json
{
  "sub": "user-uuid",
  "email": "admin@example.com",
  "role": "admin",
  "iat": 1234567890,
  "exp": 1234567890
}
```

---

## WebSocket

### Gateway de Asientos

**Ubicación:** `src/modules/eventos/eventos.gateway.ts` (si existe)

### Eventos

#### 1. Unirse a Evento
```typescript
// Cliente
socket.emit('joinEvent', { eventoId: 'evt-123' })

// Servidor
@SubscribeMessage('joinEvent')
handleJoinEvent(@MessageBody() data: { eventoId: string }) {
  // Usuario se une a la sala del evento
}
```

#### 2. Reservar Asiento
```typescript
// Cliente
socket.emit('reserveSeat', {
  eventoId: 'evt-123',
  asientoId: 'A-1',
  userId: 'user-uuid'
})

// Servidor
@SubscribeMessage('reserveSeat')
async handleReserveSeat(@MessageBody() data: ReserveSeatDto) {
  // Validar disponibilidad
  // Marcar como ocupado
  // Notificar a otros usuarios
  this.server.to(data.eventoId).emit('seatReserved', {
    seatId: data.asientoId
  })
}
```

#### 3. Asiento Reservado
```typescript
// Servidor → Cliente
socket.emit('seatReserved', {
  seatId: 'A-1'
})
```

---

## DTOs (Data Transfer Objects)

### CreateEventoDto
```typescript
export class CreateEventoDto {
  @IsString()
  @IsNotEmpty()
  titulo: string

  @IsOptional()
  @IsString()
  descripcion?: string

  @IsOptional()
  @IsString()
  imagenUrl?: string

  @IsDateString()
  fecha: string

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  hora: string

  @IsString()
  @IsNotEmpty()
  ubicacion: string

  @IsInt()
  @IsPositive()
  capacidad: number

  @IsNumber()
  @IsPositive()
  precio: number

  @IsOptional()
  @IsString()
  categoria?: string

  @IsOptional()
  @IsString()
  estado?: string

  @IsOptional()
  seatMapConfig?: any

  @IsOptional()
  @IsArray()
  sectores?: CreateSectorDto[]
}
```

---

## Errores Comunes

### 1. Evento No Encontrado
```json
{
  "statusCode": 404,
  "message": "Evento no encontrado",
  "error": "Not Found"
}
```

### 2. Validación Fallida
```json
{
  "statusCode": 400,
  "message": [
    "titulo should not be empty",
    "precio must be a positive number"
  ],
  "error": "Bad Request"
}
```

### 3. No Autorizado
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### 4. Prohibido (No Admin)
```json
{
  "statusCode": 403,
  "message": "Se requiere rol de administrador",
  "error": "Forbidden"
}
```

---

## Variables de Entorno

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="24h"

# Server
PORT=3000
NODE_ENV="development"

# WebSocket
WS_PORT=3001
```

---

## Migraciones de Base de Datos

### Crear Migración
```bash
npx prisma migrate dev --name add_seatmap_config
```

### Actualizar Schema
```bash
npx prisma generate
```

### Resetear Base de Datos
```bash
npx prisma migrate reset
```

---

## Testing

### Ejecutar Tests
```bash
npm run test
```

### Tests E2E
```bash
npm run test:e2e
```

---

## Deploy

### Build
```bash
npm run build
```

### Start Production
```bash
npm run start:prod
```

---

## Buenas Prácticas

### 1. Validación de Datos
```typescript
// Siempre usar DTOs con class-validator
@Post()
createEvento(@Body() data: CreateEventoDto) {
  return this.eventosService.createEvento(data)
}
```

### 2. Manejo de Errores
```typescript
try {
  const evento = await this.prisma.evento.create({ data })
  return evento
} catch (error) {
  if (error.code === 'P2002') {
    throw new ConflictException('El evento ya existe')
  }
  throw error
}
```

### 3. Transacciones
```typescript
await this.prisma.$transaction(async (tx) => {
  const evento = await tx.evento.create({ data: eventoData })
  await tx.sector.create({ data: sectorData })
  return evento
})
```

---

## Archivos Principales

| Archivo | Descripción |
|---------|-------------|
| `src/modules/eventos/eventos.controller.ts` | Endpoints HTTP |
| `src/modules/eventos/eventos.service.ts` | Lógica de negocio |
| `src/modules/admin/admin.controller.ts` | Endpoints admin |
| `src/modules/admin/admin.service.ts` | Lógica admin |
| `src/modules/auth/auth.controller.ts` | Autenticación |
| `prisma/schema.prisma` | Esquema de BD |

---

## Próximos Pasos

Para continuar desarrollando:

1. ✅ CRUD de eventos
2. ✅ Configuración de mapa de asientos
3. ⏳ Validación de disponibilidad de asientos
4. ⏳ Sistema de reservas con expiración
5. ⏳ Pasarela de pago
6. ⏳ Generación de tickets/QR
7. ⏳ Estadísticas y reportes

---

**Última actualización:** Febrero 2026
**Versión:** 1.0.0
