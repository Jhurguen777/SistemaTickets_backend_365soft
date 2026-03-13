-- CreateTable
CREATE TABLE "datos_asistentes" (
    "id" TEXT NOT NULL,
    "compraId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "documento" TEXT,
    "oficina" TEXT,
    "asistenciaRegistrada" BOOLEAN NOT NULL DEFAULT false,
    "fechaAsistencia" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "datos_asistentes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "datos_asistentes_compraId_key" ON "datos_asistentes"("compraId");

-- CreateIndex
CREATE INDEX "datos_asistentes_compraId_idx" ON "datos_asistentes"("compraId");

-- CreateIndex
CREATE INDEX "datos_asistentes_email_idx" ON "datos_asistentes"("email");

-- CreateIndex
CREATE INDEX "datos_asistentes_documento_idx" ON "datos_asistentes"("documento");

-- AddForeignKey
ALTER TABLE "datos_asistentes" ADD CONSTRAINT "datos_asistentes_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "compras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
