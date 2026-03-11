-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('USUARIO', 'ADMIN');

-- CreateEnum
CREATE TYPE "TipoRol" AS ENUM ('SUPER_ADMIN', 'GESTOR_EVENTOS', 'GESTOR_REPORTES', 'GESTOR_ASISTENCIA', 'GESTOR_USUARIOS');

-- CreateEnum
CREATE TYPE "EstadoRol" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "EstadoEvento" AS ENUM ('ACTIVO', 'PAUSADO', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoAsiento" AS ENUM ('DISPONIBLE', 'RESERVANDO', 'VENDIDO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'PAGADO', 'REEMBOLSADO', 'FALLIDO');

-- CreateEnum
CREATE TYPE "EstadoQr" AS ENUM ('PENDIENTE', 'PAGADO', 'CANCELADO', 'VENCIDO');

-- CreateEnum
CREATE TYPE "EstadoReembolso" AS ENUM ('SOLICITADO', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'PROCESADO');

-- CreateEnum
CREATE TYPE "TipoCertificado" AS ENUM ('PERSONALIZADO', 'ASISTENCIA_ESTANDAR', 'FINALIZACION', 'EXCELENCIA');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT,
    "password" TEXT,
    "ci" TEXT,
    "telefono" TEXT,
    "agencia" TEXT,
    "googleId" TEXT,
    "rol" "Rol" NOT NULL DEFAULT 'USUARIO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "tipoRol" "TipoRol" NOT NULL DEFAULT 'GESTOR_EVENTOS',
    "estado" "EstadoRol" NOT NULL DEFAULT 'ACTIVO',
    "ultimoAcceso" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "hora" TEXT NOT NULL,
    "ubicacion" TEXT NOT NULL,
    "direccion" TEXT,
    "imagenUrl" TEXT,
    "capacidad" INTEGER NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'Fiestas',
    "subcategoria" TEXT,
    "organizer" TEXT,
    "doorsOpen" TEXT,
    "estado" "EstadoEvento" NOT NULL DEFAULT 'ACTIVO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "seatMapConfig" JSONB,
    "permitirMultiplesAsientos" BOOLEAN NOT NULL DEFAULT false,
    "limiteAsientosPorUsuario" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sectores_evento" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL,
    "disponible" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sectores_evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asientos" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "fila" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "precio" DOUBLE PRECISION,
    "estado" "EstadoAsiento" NOT NULL DEFAULT 'DISPONIBLE',
    "reservadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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
    "qrPagoId" TEXT,
    "qrPagoAlias" TEXT,
    "qrCode" TEXT NOT NULL,
    "qrCodeUsado" BOOLEAN NOT NULL DEFAULT false,
    "certificadoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantillas_certificado" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCertificado" NOT NULL DEFAULT 'PERSONALIZADO',
    "descripcion" TEXT,
    "contenido" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plantillas_certificado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificados" (
    "id" TEXT NOT NULL,
    "compraId" TEXT,
    "usuarioId" TEXT,
    "plantillaId" TEXT NOT NULL,
    "nombreDestinatario" TEXT,
    "emailDestinatario" TEXT,
    "codigo" TEXT NOT NULL,
    "urlArchivo" TEXT,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviado" BOOLEAN NOT NULL DEFAULT false,
    "fechaEnvio" TIMESTAMP(3),

    CONSTRAINT "certificados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_envios_certificados" (
    "id" TEXT NOT NULL,
    "plantillaId" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "cantidadEnviada" INTEGER NOT NULL DEFAULT 0,
    "cantidadError" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "fechaEnvio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_envios_certificados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_googleId_key" ON "usuarios"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_email_key" ON "roles"("email");

-- CreateIndex
CREATE INDEX "asientos_eventoId_idx" ON "asientos"("eventoId");

-- CreateIndex
CREATE UNIQUE INDEX "asientos_eventoId_fila_numero_key" ON "asientos"("eventoId", "fila", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "qr_pagos_alias_key" ON "qr_pagos"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "qr_pagos_compraId_key" ON "qr_pagos"("compraId");

-- CreateIndex
CREATE INDEX "qr_pagos_estado_idx" ON "qr_pagos"("estado");

-- CreateIndex
CREATE INDEX "qr_pagos_compraId_idx" ON "qr_pagos"("compraId");

-- CreateIndex
CREATE UNIQUE INDEX "compras_asientoId_key" ON "compras"("asientoId");

-- CreateIndex
CREATE UNIQUE INDEX "compras_stripePaymentId_key" ON "compras"("stripePaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "compras_qrPagoId_key" ON "compras"("qrPagoId");

-- CreateIndex
CREATE UNIQUE INDEX "compras_qrPagoAlias_key" ON "compras"("qrPagoAlias");

-- CreateIndex
CREATE UNIQUE INDEX "compras_qrCode_key" ON "compras"("qrCode");

-- CreateIndex
CREATE INDEX "compras_usuarioId_idx" ON "compras"("usuarioId");

-- CreateIndex
CREATE INDEX "compras_eventoId_idx" ON "compras"("eventoId");

-- CreateIndex
CREATE INDEX "compras_estadoPago_idx" ON "compras"("estadoPago");

-- CreateIndex
CREATE UNIQUE INDEX "certificados_compraId_key" ON "certificados"("compraId");

-- CreateIndex
CREATE UNIQUE INDEX "certificados_codigo_key" ON "certificados"("codigo");

-- CreateIndex
CREATE INDEX "certificados_usuarioId_idx" ON "certificados"("usuarioId");

-- CreateIndex
CREATE INDEX "certificados_plantillaId_idx" ON "certificados"("plantillaId");

-- CreateIndex
CREATE UNIQUE INDEX "asistencias_compraId_key" ON "asistencias"("compraId");

-- CreateIndex
CREATE UNIQUE INDEX "reembolsos_compraId_key" ON "reembolsos"("compraId");

-- CreateIndex
CREATE UNIQUE INDEX "reembolsos_stripeRefundId_key" ON "reembolsos"("stripeRefundId");

-- AddForeignKey
ALTER TABLE "sectores_evento" ADD CONSTRAINT "sectores_evento_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asientos" ADD CONSTRAINT "asientos_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_asientoId_fkey" FOREIGN KEY ("asientoId") REFERENCES "asientos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_qrPagoId_fkey" FOREIGN KEY ("qrPagoId") REFERENCES "qr_pagos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantillas_certificado" ADD CONSTRAINT "plantillas_certificado_creadorId_fkey" FOREIGN KEY ("creadorId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "compras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "plantillas_certificado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_envios_certificados" ADD CONSTRAINT "historial_envios_certificados_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "plantillas_certificado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "compras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
