-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE';
ALTER TYPE "AuditAction" ADD VALUE 'DELETE';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "entity" TEXT,
ADD COLUMN     "entityId" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_createdAt_idx" ON "AuditLog"("entity", "entityId", "createdAt");
