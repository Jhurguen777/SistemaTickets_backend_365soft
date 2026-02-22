# 📊 SCHEMA DE PRISMA COMPLETO - SISTEMA DE TICKETS 365Soft

## 📋 TABLA DE CONTENIDOS
1. [Modelos de Datos](#modelos-de-datos)
2. [Relaciones](#relaciones)
3. [Enums](#enums)
4. [Índices](#índices)

---

## 🗄️ MODELOS DE DATOS

### 1. USUARIO
**Tabla:** `usuarios`

```prisma
model Usuario {
  id            String    @id @default(uuid())
  email         String    @unique
  nombre        String
  telefono      String?
  agencia       String?
  googleId      String?   @unique
  rol           Rol       @default(USUARIO)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relaciones
  compras       Compra[]
  asistencias   Asistencia[]
}
```

**Propósito:** Almacena información de usuarios y autenticación
**Campos importantes:**
- `googleId`: Para OAuth con Google
- `rol`: USUARIO o ADMIN
- `telefono`: Requerido para completar perfil

---

### 2. EVENTO
**Tabla:** `eventos`

```prisma
model Evento {
  id          String       @id @default(uuid())
  titulo      String
  descripcion String?
  fecha       DateTime
  hora        String
  ubicacion   String
  imagenUrl   String?
  capacidad   Int
  precio      Float
  estado      EstadoEvento @default(ACTIVO)
  activo      Boolean      @default(true)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  // Relaciones
  asientos    Asiento[]
  compras     Compra[]
}
```

**Propósito:** Almacena información de eventos
**Campos importantes:**
- `capacidad`: Número total de asientos
- `precio`: Precio base por ticket
- `estado`: ACTIVO, PAUSADO, FINALIZADO, CANCELADO
- `activo`: Soft delete

---

### 3. ASIENTO
**Tabla:** `asientos`

```prisma
model Asiento {
  id          String        @id @default(uuid())
  eventoId    String
  fila        String
  numero      Int
  estado      EstadoAsiento @default(DISPONIBLE)
  reservadoEn DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  // Relaciones
  evento      Evento        @relation(fields: [eventoId], references: [id], onDelete: Cascade)
  compra      Compra?
}
```

**Propósito:** Gestiona asientos de eventos
**Campos importantes:**
- `fila` + `numero`: Identificador único del asiento (ej: A5, F12)
- `estado`: DISPONIBLE, RESERVANDO, VENDIDO, BLOQUEADO
- `reservadoEn`: Timestamp de reserva (para expiración de 5 min)

**Constraints:**
- Único: `[eventoId, fila, numero]`
- Índice: `eventoId`

---

### 4. QR PAGOS ⭐ NUEVO
**Tabla:** `qr_pagos`

```prisma
model QrPagos {
  id                String        @id @default(uuid())
  alias             String        @unique
  estado            EstadoQr      @default(PENDIENTE)
  monto             Float
  moneda            String        @default("BOB")
  compraId          String?       @unique
  fechaVencimiento  DateTime
  imagenQr          String?
  detalleGlosa      String?
  numeroOrden       String?
  nombreCliente     String?
  documentoCliente  String?
  cuentaCliente     String?
  fechaproceso      DateTime?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  // Relaciones
  compra            Compra?
}
```

**Propósito:** Gestiona pagos QR del Banco MC4
**Campos importantes:**
- `alias`: Identificador único generado (ej: QR365T20250220153000123)
- `estado`: PENDIENTE, PAGADO, CANCELADO, VENCIDO
- `imagenQr`: QR en base64 del banco
- `compraId`: Se relaciona con la compra cuando se paga

**Índices:**
- `estado`: Para consultar QRs pendientes
- `compraId`: Para buscar QR de una compra

---

### 5. COMPRA
**Tabla:** `compras`

```prisma
model Compra {
  id                String        @id @default(uuid())
  usuarioId         String
  eventoId          String
  asientoId         String        @unique
  monto             Float
  moneda            String        @default("USD")
  metodoPago        String?
  estadoPago        EstadoPago    @default(PENDIENTE)
  stripePaymentId   String?       @unique
  qrPagoId          String?       @unique  ⭐ NUEVO
  qrPagoAlias       String?       @unique  ⭐ NUEVO
  qrCode            String        @unique
  qrCodeUsado       Boolean       @default(false)
  certificadoUrl    String?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  // Relaciones
  usuario           Usuario       @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  evento            Evento        @relation(fields: [eventoId], references: [id], onDelete: Cascade)
  asiento           Asiento       @relation(fields: [asientoId], references: [id], onDelete: Cascade)
  qrPago            QrPagos?      @relation(fields: [qrPagoId], references: [id])  ⭐ NUEVO
  asistencia        Asistencia?
}
```

**Propósito:** Almacena transacciones de compra
**Campos importantes:**
- `estadoPago`: PENDIENTE, PAGADO, REEMBOLSADO, FALLIDO
- `qrPagoId`: FK a QrPagos (cuando se paga con QR)
- `qrPagoAlias`: Alias del QR para referencia rápida
- `qrCode`: QR code de entrada (diferente al QR de pago)
- `qrCodeUsado`: Si ya ingresó al evento

**Campos NUEVOS para QR:**
- `qrPagoId`: Relación con QrPagos
- `qrPagoAlias`: Alias del QR del banco

**Índices:**
- `usuarioId`: Compras por usuario
- `eventoId`: Compras por evento
- `estadoPago`: Para reportes

---

### 6. ASISTENCIA
**Tabla:** `asistencias`

```prisma
model Asistencia {
  id            String   @id @default(uuid())
  compraId      String   @unique
  usuarioId     String
  ingresoEn     DateTime @default(now())
  validadoPor   String?
  ubicacionGPS  String?
  dispositivoId String?

  // Relaciones
  compra        Compra   @relation(fields: [compraId], references: [id], onDelete: Cascade)
  usuario       Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
}
```

**Propósito:** Registra ingreso al evento
**Campos importantes:**
- `compraId`: Único (no puede ingresar dos veces)
- `validadoPor`: ID del admin que escaneó
- `ubicacionGPS`: Para auditoría
- `dispositivoId`: Para control

---

### 7. REEMBOLSO
**Tabla:** `reembolsos`

```prisma
model Reembolso {
  id             String         @id @default(uuid())
  compraId       String         @unique
  monto          Float
  razon          String
  estado         EstadoReembolso @default(SOLICITADO)
  stripeRefundId String?        @unique
  aprobado       Boolean        @default(false)
  solicitadoEn   DateTime       @default(now())
  resolvedoEn    DateTime?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
}
```

**Propósito:** Gestiona solicitudes de reembolso
**Campos importantes:**
- `estado`: SOLICITADO, EN_REVISION, APROBADO, RECHAZADO, PROCESADO
- `stripeRefundId`: Para reembolsos Stripe
- `aprobado`: Booleano rápido para filtros

---

## 🔗 RELACIONES

```
Usuario (1) ─────< (N) Compra
Usuario (1) ─────< (N) Asistencia

Evento (1) ─────< (N) Asiento
Evento (1) ─────< (N) Compra

Asiento (1) ─────< (1) Compra

QrPagos (1) ─────< (1) Compra  ⭐ NUEVA RELACIÓN

Compra (1) ─────< (1) Asistencia
Compra (1) ─────< (1) Reembolso
```

---

## 📦 ENUMS

### 1. Rol
```prisma
enum Rol {
  USUARIO
  ADMIN
}
```

### 2. EstadoEvento
```prisma
enum EstadoEvento {
  ACTIVO
  PAUSADO
  FINALIZADO
  CANCELADO
}
```

### 3. EstadoAsiento
```prisma
enum EstadoAsiento {
  DISPONIBLE
  RESERVANDO
  VENDIDO
  BLOQUEADO
}
```

### 4. EstadoQr ⭐ NUEVO
```prisma
enum EstadoQr {
  PENDIENTE
  PAGADO
  CANCELADO
  VENCIDO
}
```

### 5. EstadoPago
```prisma
enum EstadoPago {
  PENDIENTE
  PAGADO
  REEMBOLSADO
  FALLIDO
}
```

### 6. EstadoReembolso
```prisma
enum EstadoReembolso {
  SOLICITADO
  EN_REVISION
  APROBADO
  RECHAZADO
  PROCESADO
}
```

---

## 📊 ESTADÍSTICAS DEL SCHEMA

| Categoría | Cantidad |
|-----------|----------|
| **Modelos** | 7 |
| **Enums** | 6 |
| **Relaciones** | 10 |
| **Índices** | 8+ |
| **Campos totales** | 80+ |

---

## 🆕 CAMBIOS NUEVOS (V2.0)

### Agregados:
1. ✅ Modelo `QrPagos` completo
2. ✅ Enum `EstadoQr`
3. ✅ Campo `qrPagoId` en Compra
4. ✅ Campo `qrPagoAlias` en Compra
5. ✅ Relación `QrPagos` ↔ `Compra`
6. ✅ Índice `estadoPago` en Compra

### Propósito:
- Soporte para pagos QR (Banco MC4)
- Soporte para Yape, Tigo Money, BCP Mobile
- Webhook del banco
- Verificación de pagos

---

## 🚀 PRÓXIMOS PASOS

1. **Ejecutar migración:**
   ```bash
   npm run prisma:migrate
   ```

2. **Generar Prisma Client:**
   ```bash
   npm run prisma:generate
   ```

3. **(Opcional) Seed datos:**
   ```bash
   npm run db:seed
   ```

4. **(Opcional) Abrir Prisma Studio:**
   ```bash
   npm run db:studio
   ```

---

**Última actualización:** 20 de Febrero, 2026
**Versión:** 2.0 - Con soporte para pagos QR
