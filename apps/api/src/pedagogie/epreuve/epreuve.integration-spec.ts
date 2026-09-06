import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaClient, StatutValidation, TypeEpreuve } from '@prisma/client';
import { createTestPrisma, truncateAll } from '../../../test/prisma-test-client';
import { EpreuveService } from './epreuve.service';

// ── Utilitaires ──────────────────────────────────────────────────────────────
let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${seq++}`;

/** Pagination par défaut (cf. PaginationDto) — page 1, 20 éléments. */
const PAGE_DEFAUT = { page: 1, limit: 20 };

let prisma: PrismaClient;
let service: EpreuveService;

async function makeCoursScenarise(statutValidation: StatutValidation = StatutValidation.APPROUVE) {
  const user = await prisma.utilisateur.create({
    data: { nom: 'Ens', prenom: 'Seignant', email: uid('ens') + '@t.local', motDePasseHash: 'x' },
  });
  const personnel = await prisma.personnel.create({
    data: {
      userId: user.id,
      matricule: uid('MAT'),
      poste: 'Enseignant',
      dateEmbauche: new Date(Date.UTC(2020, 0, 1)),
      salaire: 0,
    },
  });
  const enseignant = await prisma.enseignant.create({
    data: { personnelId: personnel.id, specialite: 'Test', grade: 'A' },
  });
  return prisma.coursScenarise.create({
    data: {
      enseignantId: enseignant.id,
      titre: 'Cours test',
      codeCours: uid('CRS'),
      description: 'desc',
      objectifsPedagogiques: 'obj',
      statutValidation,
    },
  });
}

async function makeClasse() {
  const filiere = await prisma.filiere.create({ data: { code: uid('F'), nom: 'Filiere test' } });
  return prisma.classe.create({
    data: { codeClasse: uid('C'), libelle: 'Classe test', niveau: 'L1', filiereId: filiere.id },
  });
}

async function makeCoursClasse(statutValidation: StatutValidation = StatutValidation.APPROUVE) {
  const cours = await makeCoursScenarise(statutValidation);
  const classe = await makeClasse();
  return prisma.coursClasse.create({ data: { coursId: cours.id, classeId: classe.id } });
}

/** Etudiant + Inscription, pour rattacher une NoteEtudiant à une Epreuve (test D3). */
async function makeInscription() {
  const studentUser = await prisma.utilisateur.create({
    data: { nom: 'Etu', prenom: 'Diant', email: uid('etu') + '@t.local', motDePasseHash: 'x' },
  });
  const etudiant = await prisma.etudiant.create({
    data: { userId: studentUser.id, dateNaissance: new Date(Date.UTC(2000, 0, 1)) },
  });
  const classe = await makeClasse();
  const annee = await prisma.anneeUniversitaire.create({
    data: {
      libelle: uid('AU'),
      dateDebut: new Date(Date.UTC(2026, 8, 1)),
      dateFin: new Date(Date.UTC(2027, 5, 1)),
    },
  });
  return prisma.inscription.create({
    data: { etudiantId: etudiant.id, classeId: classe.id, anneeId: annee.id },
  });
}

// ── Setup ────────────────────────────────────────────────────────────────────
beforeAll(() => {
  prisma = createTestPrisma(); // garde-fou : refuse si != isseg_test
  service = new EpreuveService(prisma as never);
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await truncateAll(prisma);
});

// ════════════════════════════════════════════════════════════════════════════
describe('Intégration — EpreuveService (isseg_test)', () => {
  // ── A. create ─────────────────────────────────────────────────────────────
  describe('create', () => {
    it('A1 — création nominale : persistée en base avec les bons champs', async () => {
      const coursClasse = await makeCoursClasse(StatutValidation.APPROUVE);

      const result = await service.create({ coursClasseId: coursClasse.id, type: TypeEpreuve.CC });

      expect(result.id).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
      expect(result.coursClasseId).toBe(coursClasse.id);
      expect(result.type).toBe(TypeEpreuve.CC);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);

      const persisted = await prisma.epreuve.findUnique({ where: { id: result.id } });
      expect(persisted).not.toBeNull();
      expect(persisted).toMatchObject({ coursClasseId: coursClasse.id, type: TypeEpreuve.CC });
    });

    it('A2 — CoursClasse inexistant : 404 (NotFoundException), aucune écriture', async () => {
      await expect(
        service.create({ coursClasseId: '00000000-0000-4000-8000-000000000000', type: TypeEpreuve.CC }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(await prisma.epreuve.count()).toBe(0);
    });

    it('A3 — CoursScenarise non APPROUVE : 409 (ConflictException), aucune écriture', async () => {
      const coursClasse = await makeCoursClasse(StatutValidation.EN_ATTENTE);

      await expect(
        service.create({ coursClasseId: coursClasse.id, type: TypeEpreuve.CC }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(await prisma.epreuve.count()).toBe(0);
    });

    it('A4 — deux Epreuves du même type pour le même CoursClasse : les deux créations réussissent', async () => {
      const coursClasse = await makeCoursClasse(StatutValidation.APPROUVE);

      const e1 = await service.create({ coursClasseId: coursClasse.id, type: TypeEpreuve.CC });
      const e2 = await service.create({ coursClasseId: coursClasse.id, type: TypeEpreuve.CC });

      expect(e1.id).not.toBe(e2.id);
      const rows = await prisma.epreuve.findMany({ where: { coursClasseId: coursClasse.id } });
      expect(rows).toHaveLength(2);
    });
  });

  // ── B. findAll ────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('B1 — liste complète', async () => {
      const cc1 = await makeCoursClasse();
      const cc2 = await makeCoursClasse();
      await service.create({ coursClasseId: cc1.id, type: TypeEpreuve.CC });
      await service.create({ coursClasseId: cc2.id, type: TypeEpreuve.EXAMEN });

      const result = await service.findAll({ ...PAGE_DEFAUT });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ total: 2, page: 1, limit: 20, totalPages: 1 });
    });

    it('B2 — filtre coursClasseId', async () => {
      const cc1 = await makeCoursClasse();
      const cc2 = await makeCoursClasse();
      const e1 = await service.create({ coursClasseId: cc1.id, type: TypeEpreuve.CC });
      await service.create({ coursClasseId: cc2.id, type: TypeEpreuve.CC });

      const result = await service.findAll({ ...PAGE_DEFAUT, coursClasseId: cc1.id });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(e1.id);
      expect(result.meta.total).toBe(1);
    });

    it('B3 — filtre type', async () => {
      const cc = await makeCoursClasse();
      await service.create({ coursClasseId: cc.id, type: TypeEpreuve.CC });
      const tp = await service.create({ coursClasseId: cc.id, type: TypeEpreuve.TP });

      const result = await service.findAll({ ...PAGE_DEFAUT, type: TypeEpreuve.TP });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(tp.id);
      expect(result.meta.total).toBe(1);
    });

    it('B4 — combinaison coursClasseId + type', async () => {
      const cc1 = await makeCoursClasse();
      const cc2 = await makeCoursClasse();
      const target = await service.create({ coursClasseId: cc1.id, type: TypeEpreuve.EXAMEN });
      await service.create({ coursClasseId: cc1.id, type: TypeEpreuve.CC });
      await service.create({ coursClasseId: cc2.id, type: TypeEpreuve.EXAMEN });

      const result = await service.findAll({
        ...PAGE_DEFAUT,
        coursClasseId: cc1.id,
        type: TypeEpreuve.EXAMEN,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(target.id);
      expect(result.meta.total).toBe(1);
    });

    // ── Pagination (BACK-02-A) ──────────────────────────────────────────────

    it('B5 — page par défaut : meta cohérent avec le nombre réel d’enregistrements', async () => {
      const cc = await makeCoursClasse();
      for (let i = 0; i < 3; i += 1) {
        await service.create({ coursClasseId: cc.id, type: TypeEpreuve.CC });
      }

      const result = await service.findAll({ ...PAGE_DEFAUT });

      expect(result.data).toHaveLength(3);
      expect(result.meta).toEqual({ total: 3, page: 1, limit: 20, totalPages: 1 });
    });

    it('B6 — dernière page partielle : reste des éléments, sans doublon', async () => {
      const cc = await makeCoursClasse();
      for (let i = 0; i < 5; i += 1) {
        await service.create({ coursClasseId: cc.id, type: TypeEpreuve.CC });
      }

      const page1 = await service.findAll({ page: 1, limit: 2 });
      const page3 = await service.findAll({ page: 3, limit: 2 });

      expect(page1.data).toHaveLength(2);
      expect(page3.data).toHaveLength(1); // 5 = 2 + 2 + 1
      expect(page3.meta).toEqual({ total: 5, page: 3, limit: 2, totalPages: 3 });

      const idsPage1 = page1.data.map((e) => e.id);
      expect(idsPage1).not.toContain(page3.data[0].id);
    });

    it('B7 — page au-delà du dernier index : data vide, meta.total inchangé', async () => {
      const cc = await makeCoursClasse();
      await service.create({ coursClasseId: cc.id, type: TypeEpreuve.CC });

      const result = await service.findAll({ page: 5, limit: 20 });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(1);
    });

    it('B8 — pagination + filtre : meta.total ne compte que les lignes filtrées', async () => {
      const cc = await makeCoursClasse();
      await service.create({ coursClasseId: cc.id, type: TypeEpreuve.TP });
      await service.create({ coursClasseId: cc.id, type: TypeEpreuve.TP });
      await service.create({ coursClasseId: cc.id, type: TypeEpreuve.EXAMEN });

      const result = await service.findAll({ page: 1, limit: 1, type: TypeEpreuve.TP });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 2, page: 1, limit: 1, totalPages: 2 });
    });
  });

  // ── C. findOne ────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('C1 — Epreuve existante : données conformes', async () => {
      const cc = await makeCoursClasse();
      const created = await service.create({ coursClasseId: cc.id, type: TypeEpreuve.RATTRAPAGE });

      const result = await service.findOne(created.id);

      expect(result).toMatchObject({ id: created.id, coursClasseId: cc.id, type: TypeEpreuve.RATTRAPAGE });
    });

    it('C2 — Epreuve inexistante : NotFoundException', async () => {
      await expect(service.findOne('00000000-0000-4000-8000-000000000000')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── D. remove ─────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('D1 — suppression nominale : absente en base ensuite', async () => {
      const cc = await makeCoursClasse();
      const created = await service.create({ coursClasseId: cc.id, type: TypeEpreuve.CC });

      await service.remove(created.id);

      expect(await prisma.epreuve.findUnique({ where: { id: created.id } })).toBeNull();
    });

    it('D2 — Epreuve inexistante : NotFoundException', async () => {
      await expect(service.remove('00000000-0000-4000-8000-000000000000')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('D3 — suppression bloquée par une NoteEtudiant rattachée : Epreuve et NoteEtudiant conservées', async () => {
      const cc = await makeCoursClasse();
      const created = await service.create({ coursClasseId: cc.id, type: TypeEpreuve.CC });
      const inscription = await makeInscription();
      const note = await prisma.noteEtudiant.create({
        data: { epreuveId: created.id, inscriptionId: inscription.id, noteBrute: 15 },
      });

      await expect(service.remove(created.id)).rejects.toBeInstanceOf(ConflictException);

      expect(await prisma.epreuve.findUnique({ where: { id: created.id } })).not.toBeNull();
      expect(await prisma.noteEtudiant.findUnique({ where: { id: note.id } })).not.toBeNull();
    });
  });
});
