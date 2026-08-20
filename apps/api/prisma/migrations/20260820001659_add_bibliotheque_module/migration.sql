-- CreateEnum
CREATE TYPE "StatutOuvrage" AS ENUM ('DISPONIBLE', 'EMPRUNTE', 'RESERVE', 'EN_MAINTENANCE', 'PERDU');

-- CreateEnum
CREATE TYPE "StatutEmprunt" AS ENUM ('EN_COURS', 'RETOURNE', 'EN_RETARD', 'PERDU');

-- CreateEnum
CREATE TYPE "TypeAbonne" AS ENUM ('ETUDIANT_L1_L2', 'ETUDIANT_L3_M2', 'ENSEIGNANT', 'PERSONNEL_ADMIN');

-- CreateEnum
CREATE TYPE "TypeDocumentAcademique" AS ENUM ('THESE', 'MEMOIRE_LICENCE', 'MEMOIRE_MASTER');

-- CreateEnum
CREATE TYPE "StatutReservation" AS ENUM ('EN_ATTENTE', 'HONOREE', 'EXPIREE', 'ANNULEE');

-- CreateTable
CREATE TABLE "SectionBibliotheque" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionBibliotheque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ouvrage" (
    "id" TEXT NOT NULL,
    "isbn" TEXT,
    "titre" TEXT NOT NULL,
    "auteur" TEXT NOT NULL,
    "editeur" TEXT NOT NULL,
    "anneeEdition" INTEGER NOT NULL,
    "cote" TEXT NOT NULL,
    "classificationDewey" TEXT,
    "matieres" TEXT[],
    "salle" TEXT NOT NULL,
    "etagere" TEXT NOT NULL,
    "nombreExemplaires" INTEGER NOT NULL DEFAULT 1,
    "exemplairesDisponibles" INTEGER NOT NULL DEFAULT 1,
    "statut" "StatutOuvrage" NOT NULL DEFAULT 'DISPONIBLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sectionId" TEXT NOT NULL,

    CONSTRAINT "Ouvrage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Emprunt" (
    "id" TEXT NOT NULL,
    "ouvrageId" TEXT NOT NULL,
    "emprunteurId" TEXT NOT NULL,
    "dateEmprunt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateRetourPrevue" TIMESTAMP(3) NOT NULL,
    "dateRetourEffectif" TIMESTAMP(3),
    "renouvellementsRestants" INTEGER NOT NULL DEFAULT 1,
    "statut" "StatutEmprunt" NOT NULL DEFAULT 'EN_COURS',
    "retardJours" INTEGER NOT NULL DEFAULT 0,
    "montantPenalite" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "penalitesPayees" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Emprunt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Abonne" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "typeAbonne" "TypeAbonne" NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFin" TIMESTAMP(3),
    "statutActif" BOOLEAN NOT NULL DEFAULT true,
    "limiteEmprunts" INTEGER,
    "dureePretJours" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Abonne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAcademique" (
    "id" TEXT NOT NULL,
    "type" "TypeDocumentAcademique" NOT NULL,
    "titre" TEXT NOT NULL,
    "anneeUniversitaire" TEXT NOT NULL,
    "filiere" TEXT NOT NULL,
    "niveau" TEXT NOT NULL,
    "urlPdf" TEXT NOT NULL,
    "motsCles" TEXT[],
    "resume" TEXT NOT NULL,
    "diffusionAutorisee" BOOLEAN NOT NULL DEFAULT false,
    "embargoJusqua" TIMESTAMP(3),
    "nombreTelechargements" INTEGER NOT NULL DEFAULT 0,
    "nombreVues" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "auteurId" TEXT NOT NULL,
    "directeurMemoireId" TEXT,

    CONSTRAINT "DocumentAcademique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "ouvrageId" TEXT NOT NULL,
    "abonneId" TEXT NOT NULL,
    "dateReservation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" "StatutReservation" NOT NULL DEFAULT 'EN_ATTENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SectionBibliotheque_code_key" ON "SectionBibliotheque"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Ouvrage_isbn_key" ON "Ouvrage"("isbn");

-- CreateIndex
CREATE UNIQUE INDEX "Ouvrage_cote_key" ON "Ouvrage"("cote");

-- CreateIndex
CREATE INDEX "Emprunt_emprunteurId_idx" ON "Emprunt"("emprunteurId");

-- CreateIndex
CREATE INDEX "Emprunt_ouvrageId_idx" ON "Emprunt"("ouvrageId");

-- CreateIndex
CREATE UNIQUE INDEX "Abonne_utilisateurId_key" ON "Abonne"("utilisateurId");

-- CreateIndex
CREATE INDEX "Reservation_ouvrageId_idx" ON "Reservation"("ouvrageId");

-- CreateIndex
CREATE INDEX "Reservation_abonneId_idx" ON "Reservation"("abonneId");

-- AddForeignKey
ALTER TABLE "Ouvrage" ADD CONSTRAINT "Ouvrage_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "SectionBibliotheque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emprunt" ADD CONSTRAINT "Emprunt_ouvrageId_fkey" FOREIGN KEY ("ouvrageId") REFERENCES "Ouvrage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emprunt" ADD CONSTRAINT "Emprunt_emprunteurId_fkey" FOREIGN KEY ("emprunteurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Abonne" ADD CONSTRAINT "Abonne_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAcademique" ADD CONSTRAINT "DocumentAcademique_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "Etudiant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAcademique" ADD CONSTRAINT "DocumentAcademique_directeurMemoireId_fkey" FOREIGN KEY ("directeurMemoireId") REFERENCES "Enseignant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_ouvrageId_fkey" FOREIGN KEY ("ouvrageId") REFERENCES "Ouvrage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_abonneId_fkey" FOREIGN KEY ("abonneId") REFERENCES "Abonne"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
