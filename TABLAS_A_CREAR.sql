-- ============================================
-- SISTEMA DE TICKETS 365Soft - TABLAS A CREAR
-- ============================================
-- Base de datos: PostgreSQL
-- Generado por: Prisma ORM
-- Fecha: 20 de Febrero, 2026
-- ============================================

-- 1. TABLA: usuarios
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "agencia" TEXT,
    "googleId" TEXT,
    "rol" "Rol" NOT NULL DEFAULT 'USUARIO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- Índices únicos
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");
CREATE UNIQUE INDEX "usuarios_googleId_key" ON "usuarios"("googleId");


-- 2. TABLA: eventos
CREATE TABLE "eventos" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "hora" TEXT NOT NULL,
    "ubicacion" TEXT NOT NULL,
    "imagenUrl" TEXT,
    "capacidad" INTEGER NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL,
    "estado" "EstadoEvento" NOT NULL DEFAULT 'ACTIVO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);


-- 3. TABLA: asientos
CREATE TABLE "asientos" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "fila" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "estado" "EstadoAsiento" NOT NULL DEFAULT 'DISPONIBLE',
    "reservadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asientos_pkey" PRIMARY KEY ("id")
);

-- Índices y Foreign Keys
CREATE UNIQUE INDEX "asientos_eventoId_fila_numero_key" ON "asientos"("eventoId", "fila", "numero");
CREATE INDEX "asientos_eventoId_idx" ON "asientos"("eventoId");
ALTER TABLE "asientos" ADD CONSTRAINT "asientos_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- 4. TABLA: qr_pagos ⭐ NUEVA
CREATE TABLE "qr_pagos" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "estado" "EstadoQr" NOT NULL DEFAULT 'PENDIENTE',
    "monto" DOUBLE PRECISION NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'BOB',
    "compraId" TEXT,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "imagenQr" TEXT,
    "detalleGlosa" TEXT,
    "numeroOrden" TEXT,
    "nombreCliente" TEXT,
    "documentoCliente" TEXT,
    "cuentaCliente" TEXT,
    "fechaproceso" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qr_pagos_pkey" PRIMARY KEY ("id")
);

-- Índices y Foreign Keys
CREATE UNIQUE INDEX "qr_pagos_alias_key" ON "qr_pagos"("alias");
CREATE UNIQUE INDEX "qr_pagos_compraId_key" ON "qr_pagos"("compraId");
CREATE INDEX "qr_pagos_estado_idx" ON "qr_pagos"("estado");
CREATE INDEX "qr_pagos_compraId_idx" ON "qr_pagos"("compraId");


-- 5. TABLA: compras
CREATE TABLE "compras" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "asientoId" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "metodoPago" TEXT,
    "estadoPago" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "stripePaymentId" TEXT,
    "qrPagoId" TEXT,              ⭐ NUEVO
    "qrPagoAlias" TEXT,           ⭐ NUEVO
    "qrCode" TEXT NOT NULL,
    "qrCodeUsado" BOOLEAN NOT NULL DEFAULT false,
    "certificadoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compras_pkey" PRIMARY KEY ("id")
);

-- Índices y Foreign Keys
CREATE UNIQUE INDEX "compras_asientoId_key" ON "compras"("asientoId");
CREATE UNIQUE INDEX "compras_stripePaymentId_key" ON "compras"("stripePaymentId");
CREATE UNIQUE INDEX "compras_qrPagoId_key" ON "compras"("qrPagoId");       ⭐ NUEVO
CREATE UNIQUE INDEX "compras_qrPagoAlias_key" ON "compras"("qrPagoAlias"); ⭐ NUEVO
CREATE UNIQUE INDEX "compras_qrCode_key" ON "compras"("qrCode");
CREATE INDEX "compras_usuarioId_idx" ON "compras"("usuarioId");
CREATE INDEX "compras_eventoId_idx" ON "compras"("eventoId");
CREATE INDEX "compras_estadoPago_idx" ON "compras"("estadoPago");         ⭐ NUEVO

ALTER TABLE "compras" ADD CONSTRAINT "compras_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compras" ADD CONSTRAINT "compras_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compras" ADD CONSTRAINT "compras_asientoId_fkey" FOREIGN KEY ("asientoId") REFERENCES "asientos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compras" ADD CONSTRAINT "compras_qrPagoId_fkey" FOREIGN KEY ("qrPagoId") REFERENCES "qr_pagos"("id") ON DELETE SET NULL ON UPDATE CASCADE; ⭐ NUEVO


-- 6. TABLA: asistencias
CREATE TABLE "asistencias" (
    "id" TEXT NOT NULL,
    "compraId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "ingresoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validadoPor" TEXT,
    "ubicacionGPS" TEXT,
    "dispositivoId" TEXT,

    CONSTRAINT "asistencias_pkey" PRIMARY KEY ("id")
);

-- Índices y Foreign Keys
CREATE UNIQUE INDEX "asistencias_compraId_key" ON "asistencias"("compraId");
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "compras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- 7. TABLA: reembolsos
CREATE TABLE "reembolsos" (
    "id" TEXT NOT NULL,
    "compraId" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "razon" TEXT NOT NULL,
    "estado" "EstadoReembolso" NOT NULL DEFAULT 'SOLICITADO',
    "stripeRefundId" TEXT,
    "aprobado" BOOLEAN NOT NULL DEFAULT false,
    "solicitadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reembolsos_pkey" PRIMARY KEY ("id")
);

-- Índices y Foreign Keys
CREATE UNIQUE INDEX "reembolsos_compraId_key" ON "reembolsos"("compraId");
CREATE UNIQUE INDEX "reembolsos_stripeRefundId_key" ON "reembolsos"("stripeRefundId");


-- ============================================
-- ENUMS (TYPES)
-- ============================================

-- Enum 1: Rol
CREATE TYPE "Rol" AS ENUM ('USUARIO', 'ADMIN');

-- Enum 2: EstadoEvento
CREATE TYPE "EstadoEvento" AS ENUM ('ACTIVO', 'PAUSADO', 'FINALIZADO', 'CANCELADO');

-- Enum 3: EstadoAsiento
CREATE TYPE "EstadoAsiento" AS ENUM ('DISPONIBLE', 'RESERVANDO', 'VENDIDO', 'BLOQUEADO');

-- Enum 4: EstadoQr ⭐ NUEVO
CREATE TYPE "EstadoQr" AS ENUM ('PENDIENTE', 'PAGADO', 'CANCELADO', 'VENCIDO');

-- Enum 5: EstadoPago
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'PAGADO', 'REEMBOLSADO', 'FALLIDO');

-- Enum 6: EstadoReembolso
CREATE TYPE "EstadoReembolso" AS ENUM ('SOLICITADO', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'PROCESADO');


-- ============================================
-- RESUMEN
-- ============================================

-- Total de tablas: 7
-- Total de enums: 6
-- Total de índices: 20+
-- Total de foreign keys: 10

-- ⭐ CAMBIOS NUEVOS:
-- 1. Nueva tabla: qr_pagos
-- 2. Nuevo enum: EstadoQr
-- 3. Nuevos campos en compras: qrPagoId, qrPagoAlias
-- 4. Nuevo índice en compras: estadoPago
-- 5. Nueva FK: compras.qrPagoId → qr_pagos.id

-- ============================================
