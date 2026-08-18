-- CreateEnum
CREATE TYPE "TypeEpreuve" AS ENUM ('CC', 'TP', 'EXAMEN', 'RATTRAPAGE');

-- AlterTable
ALTER TABLE "Filiere" ADD COLUMN     "departementId" TEXT;

-- CreateTable
CREATE TABLE "CoursClasse" (
    "id" TEXT NOT NULL,
    "coursId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoursClasse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Epreuve" (
    "id" TEXT NOT NULL,
    "coursClasseId" TEXT NOT NULL,
    "type" "TypeEpreuve" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Epreuve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteEtudiant" (
    "id" TEXT NOT NULL,
    "epreuveId" TEXT NOT NULL,
    "inscriptionId" TEXT NOT NULL,
    "noteBrute" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteEtudiant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteEtudiantHistory" (
    "id" TEXT NOT NULL,
    "noteEtudiantId" TEXT NOT NULL,
    "ancienneValeur" DECIMAL(65,30) NOT NULL,
    "nouvelleValeur" DECIMAL(65,30) NOT NULL,
    "modifieParId" TEXT NOT NULL,
    "motif" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteEtudiantHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoursClasse_coursId_classeId_key" ON "CoursClasse"("coursId", "classeId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteEtudiant_epreuveId_inscriptionId_key" ON "NoteEtudiant"("epreuveId", "inscriptionId");

-- CreateIndex
CREATE INDEX "NoteEtudiantHistory_noteEtudiantId_changedAt_idx" ON "NoteEtudiantHistory"("noteEtudiantId", "changedAt");

-- CreateIndex
CREATE INDEX "NoteEtudiantHistory_modifieParId_idx" ON "NoteEtudiantHistory"("modifieParId");

-- AddForeignKey
ALTER TABLE "Filiere" ADD CONSTRAINT "Filiere_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "Departement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursClasse" ADD CONSTRAINT "CoursClasse_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "CoursScenarise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursClasse" ADD CONSTRAINT "CoursClasse_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Epreuve" ADD CONSTRAINT "Epreuve_coursClasseId_fkey" FOREIGN KEY ("coursClasseId") REFERENCES "CoursClasse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteEtudiant" ADD CONSTRAINT "NoteEtudiant_epreuveId_fkey" FOREIGN KEY ("epreuveId") REFERENCES "Epreuve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteEtudiant" ADD CONSTRAINT "NoteEtudiant_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteEtudiantHistory" ADD CONSTRAINT "NoteEtudiantHistory_noteEtudiantId_fkey" FOREIGN KEY ("noteEtudiantId") REFERENCES "NoteEtudiant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteEtudiantHistory" ADD CONSTRAINT "NoteEtudiantHistory_modifieParId_fkey" FOREIGN KEY ("modifieParId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
