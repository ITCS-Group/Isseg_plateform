-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- AlterEnum
BEGIN;
CREATE TYPE "StatutDossier_new" AS ENUM ('BROUILLON', 'SOUMIS', 'EN_TRAITEMENT', 'INSCRIT', 'REJETE');
ALTER TABLE "Etudiant" ALTER COLUMN "statutDossier" DROP DEFAULT;
ALTER TABLE "Etudiant" ALTER COLUMN "statutDossier" TYPE "StatutDossier_new" USING ("statutDossier"::text::"StatutDossier_new");
ALTER TYPE "StatutDossier" RENAME TO "StatutDossier_old";
ALTER TYPE "StatutDossier_new" RENAME TO "StatutDossier";
DROP TYPE "StatutDossier_old";
COMMIT;

-- AlterTable
ALTER TABLE "Classe" ADD COLUMN     "filiereId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "DossierInscription" ADD COLUMN     "classeId" TEXT NOT NULL,
ADD COLUMN     "dateValidation" TIMESTAMP(3),
ADD COLUMN     "motifRejet" TEXT,
ADD COLUMN     "statutDossier" "StatutDossier" NOT NULL DEFAULT 'BROUILLON',
ADD COLUMN     "validePar" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "dateSoumission" DROP NOT NULL,
ALTER COLUMN "dateSoumission" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Etudiant" DROP COLUMN "statutDossier",
ALTER COLUMN "matriculeUnique" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Filiere" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Filiere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationHistory" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "fromStatus" "StatutDossier",
    "toStatus" "StatutDossier" NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment" TEXT,

    CONSTRAINT "RegistrationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedJob" (
    "id" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedJob_pkey" PRIMARY KEY ("id")
);

-- CreateSequence
CREATE SEQUENCE matricule_global_seq START WITH 1 INCREMENT BY 1;

-- CreateIndex
CREATE UNIQUE INDEX "Filiere_code_key" ON "Filiere"("code");

-- CreateIndex
CREATE INDEX "RegistrationHistory_dossierId_changedAt_idx" ON "RegistrationHistory"("dossierId", "changedAt");

-- CreateIndex
CREATE INDEX "RegistrationHistory_changedBy_idx" ON "RegistrationHistory"("changedBy");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_createdAt_idx" ON "OutboxEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_aggregateId_eventType_idx" ON "OutboxEvent"("aggregateId", "eventType");

-- CreateIndex
CREATE INDEX "ProcessedJob_processedAt_idx" ON "ProcessedJob"("processedAt");

-- AddForeignKey
ALTER TABLE "DossierInscription" ADD CONSTRAINT "DossierInscription_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DossierInscription" ADD CONSTRAINT "DossierInscription_validePar_fkey" FOREIGN KEY ("validePar") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationHistory" ADD CONSTRAINT "RegistrationHistory_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "DossierInscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationHistory" ADD CONSTRAINT "RegistrationHistory_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classe" ADD CONSTRAINT "Classe_filiereId_fkey" FOREIGN KEY ("filiereId") REFERENCES "Filiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

