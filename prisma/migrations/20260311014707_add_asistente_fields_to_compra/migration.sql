-- AlterTable
ALTER TABLE "compras" ADD COLUMN     "apellidoAsistente" TEXT,
ADD COLUMN     "documentoAsistente" TEXT,
ADD COLUMN     "emailAsistente" TEXT,
ADD COLUMN     "nombreAsistente" TEXT,
ADD COLUMN     "oficina" TEXT,
ADD COLUMN     "telefonoAsistente" TEXT,
ALTER COLUMN "moneda" SET DEFAULT 'BOB';
