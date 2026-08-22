-- CreateEnum
CREATE TYPE "StatutAbandon" AS ENUM ('CONSTATE', 'REPRISE_DEMANDEE', 'REPRISE_ACCORDEE', 'REPRISE_REFUSEE');

-- CreateTable
CREATE TABLE "Abandon" (
    "id" TEXT NOT NULL,
    "etudiantId" TEXT NOT NULL,
    "anneeId" TEXT NOT NULL,
    "statut" "StatutAbandon" NOT NULL DEFAULT 'CONSTATE',
    "dateConstat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signaleParId" TEXT NOT NULL,
    "dateDemandeReprise" TIMESTAMP(3),
    "dateDecisionReprise" TIMESTAMP(3),
    "decideParId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Abandon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Abandon_etudiantId_anneeId_key" ON "Abandon"("etudiantId", "anneeId");

-- AddForeignKey
ALTER TABLE "Abandon" ADD CONSTRAINT "Abandon_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Abandon" ADD CONSTRAINT "Abandon_anneeId_fkey" FOREIGN KEY ("anneeId") REFERENCES "AnneeUniversitaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Abandon" ADD CONSTRAINT "Abandon_signaleParId_fkey" FOREIGN KEY ("signaleParId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Abandon" ADD CONSTRAINT "Abandon_decideParId_fkey" FOREIGN KEY ("decideParId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;
