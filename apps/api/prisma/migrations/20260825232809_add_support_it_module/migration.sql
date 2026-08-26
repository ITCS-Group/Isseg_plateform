/*
  Warnings:

  - You are about to drop the `Message` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "SousServiceIT" AS ENUM ('CENTRE_INFORMATIQUE', 'CYBER', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "NatureRequete" AS ENUM ('PANNE_MATERIEL', 'ACCES_COMPTE', 'INSTALLATION_LOGICIEL', 'INCIDENT_SECURITE', 'RESEAU', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutRequete" AS ENUM ('OUVERTE', 'EN_COURS', 'CLOTUREE');

-- CreateEnum
CREATE TYPE "StatutInscriptionCoursSupportIT" AS ENUM ('EN_COURS', 'TERMINE', 'ABANDONNE');

-- CreateEnum
CREATE TYPE "StatutPoste" AS ENUM ('DISPONIBLE', 'HORS_SERVICE');

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_parentId_fkey";

-- DropTable
DROP TABLE "Message";

-- CreateTable
CREATE TABLE "Requete" (
    "id" TEXT NOT NULL,
    "demandeurId" TEXT NOT NULL,
    "nature" "NatureRequete" NOT NULL,
    "sousServiceCible" "SousServiceIT" NOT NULL,
    "description" TEXT NOT NULL,
    "statut" "StatutRequete" NOT NULL DEFAULT 'OUVERTE',
    "dateOuverture" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateCloture" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intervention" (
    "id" TEXT NOT NULL,
    "requeteId" TEXT NOT NULL,
    "technicienId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "compteRendu" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Intervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Technicien" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "sousService" "SousServiceIT" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Technicien_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoursSupportIT" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "niveau" TEXT NOT NULL,
    "duree" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoursSupportIT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InscriptionCoursSupportIT" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "coursId" TEXT NOT NULL,
    "statut" "StatutInscriptionCoursSupportIT" NOT NULL DEFAULT 'EN_COURS',
    "progression" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InscriptionCoursSupportIT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationSupportIT" (
    "id" TEXT NOT NULL,
    "inscriptionId" TEXT NOT NULL,
    "note" DECIMAL(65,30) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statutReussite" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationSupportIT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poste" (
    "id" TEXT NOT NULL,
    "salle" TEXT NOT NULL,
    "statut" "StatutPoste" NOT NULL DEFAULT 'DISPONIBLE',
    "dateDerniereMaintenance" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Poste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageInterne" (
    "id" TEXT NOT NULL,
    "expediteurId" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageInterne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MessageDestinataires" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Requete_demandeurId_idx" ON "Requete"("demandeurId");

-- CreateIndex
CREATE INDEX "Requete_sousServiceCible_idx" ON "Requete"("sousServiceCible");

-- CreateIndex
CREATE INDEX "Intervention_requeteId_idx" ON "Intervention"("requeteId");

-- CreateIndex
CREATE INDEX "Intervention_technicienId_idx" ON "Intervention"("technicienId");

-- CreateIndex
CREATE UNIQUE INDEX "Technicien_personnelId_key" ON "Technicien"("personnelId");

-- CreateIndex
CREATE UNIQUE INDEX "InscriptionCoursSupportIT_participantId_coursId_key" ON "InscriptionCoursSupportIT"("participantId", "coursId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationSupportIT_inscriptionId_key" ON "EvaluationSupportIT"("inscriptionId");

-- CreateIndex
CREATE INDEX "Poste_salle_idx" ON "Poste"("salle");

-- CreateIndex
CREATE INDEX "MessageInterne_expediteurId_idx" ON "MessageInterne"("expediteurId");

-- CreateIndex
CREATE UNIQUE INDEX "_MessageDestinataires_AB_unique" ON "_MessageDestinataires"("A", "B");

-- CreateIndex
CREATE INDEX "_MessageDestinataires_B_index" ON "_MessageDestinataires"("B");

-- AddForeignKey
ALTER TABLE "Requete" ADD CONSTRAINT "Requete_demandeurId_fkey" FOREIGN KEY ("demandeurId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_requeteId_fkey" FOREIGN KEY ("requeteId") REFERENCES "Requete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_technicienId_fkey" FOREIGN KEY ("technicienId") REFERENCES "Technicien"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Technicien" ADD CONSTRAINT "Technicien_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscriptionCoursSupportIT" ADD CONSTRAINT "InscriptionCoursSupportIT_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscriptionCoursSupportIT" ADD CONSTRAINT "InscriptionCoursSupportIT_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "CoursSupportIT"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationSupportIT" ADD CONSTRAINT "EvaluationSupportIT_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "InscriptionCoursSupportIT"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageInterne" ADD CONSTRAINT "MessageInterne_expediteurId_fkey" FOREIGN KEY ("expediteurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MessageDestinataires" ADD CONSTRAINT "_MessageDestinataires_A_fkey" FOREIGN KEY ("A") REFERENCES "MessageInterne"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MessageDestinataires" ADD CONSTRAINT "_MessageDestinataires_B_fkey" FOREIGN KEY ("B") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
