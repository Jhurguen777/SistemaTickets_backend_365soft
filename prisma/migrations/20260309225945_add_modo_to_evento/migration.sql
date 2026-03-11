-- CreateEnum
CREATE TYPE "ModoEvento" AS ENUM ('ASIENTOS', 'CANTIDAD');

-- AlterTable
ALTER TABLE "eventos" ADD COLUMN     "modo" "ModoEvento" NOT NULL DEFAULT 'ASIENTOS';
