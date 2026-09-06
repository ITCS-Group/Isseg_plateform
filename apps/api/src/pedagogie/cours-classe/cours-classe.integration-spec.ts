import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaClient, StatutValidation, TypeEpreuve } from '@prisma/client';
import { createTestPrisma, truncateAll } from '../../../test/prisma-test-client';
import { CoursClasseService } from './cours-classe.service';

// ── Utilitaires ──────────────────────────────────────────────────────────────
let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${seq++}`;

let prisma: PrismaClient;
let service: CoursClasseService;

const ADMIN = { id: 'admin-int', roles: ['ADMIN'] };

/** Pagination par défaut (cf. PaginationDto) — page 1, 20 éléments. */
const PAGE_DEFAUT = { page: 1, limit: 20 };

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

// ── Setup ────────────────────────────────────────────────────────────────────
beforeAll(() => {
  prisma = createTestPrisma(); // garde-fou : refuse si != isseg_test
  service = new CoursClasseService(prisma as never);
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await truncateAll(prisma);
});

// ════════════════════════════════════════════════════════════════════════════
describe('Intégration — CoursClasseService (isseg_test)', () => {
  // ── findAll ───────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('sans filtre : retourne toutes les associations', async () => {
      const coursA = await makeCoursScenarise();
      const coursB = await makeCoursScenarise();
      const classeA = await makeClasse();
      const classeB = await makeClasse();
      await prisma.coursClasse.create({ data: { coursId: coursA.id, classeId: classeA.id } });
      await prisma.coursClasse.create({ data: { coursId: coursB.id, classeId: classeB.id } });

      const result = await service.findAll({ ...PAGE_DEFAUT }, ADMIN);

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ total: 2, page: 1, limit: 20, totalPages: 1 });
    });

    it('avec coursId : filtre uniquement les associations de ce cours', async () => {
      const coursA = await makeCoursScenarise();
      const coursB = await makeCoursScenarise();
      const classeA = await makeClasse();
      const classeB = await makeClasse();
      const ccA = await prisma.coursClasse.create({ data: { coursId: coursA.id, classeId: classeA.id } });
      await prisma.coursClasse.create({ data: { coursId: coursB.id, classeId: classeB.id } });

      const result = await service.findAll({ ...PAGE_DEFAUT, coursId: coursA.id }, ADMIN);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(ccA.id);
      expect(result.meta.total).toBe(1);
    });

    it('avec classeId : filtre uniquement les associations de cette classe', async () => {
      const coursA = await makeCoursScenarise();
      const coursB = await makeCoursScenarise();
      const classeA = await makeClasse();
      await prisma.coursClasse.create({ data: { coursId: coursA.id, classeId: classeA.id } });
      const ccB = await prisma.coursClasse.create({ data: { coursId: coursB.id, classeId: classeA.id } });

      const result = await service.findAll({ ...PAGE_DEFAUT, classeId: classeA.id }, ADMIN);

      expect(result.data).toHaveLength(2);
      expect(result.data.map((r) => r.id)).toEqual(expect.arrayContaining([ccB.id]));
      expect(result.meta.total).toBe(2);
    });

    it('avec coursId et classeId : filtre sur les deux critères combinés', async () => {
      const coursA = await makeCoursScenarise();
      const coursB = await makeCoursScenarise();
      const classeA = await makeClasse();
      const classeB = await makeClasse();
      const ccA = await prisma.coursClasse.create({ data: { coursId: coursA.id, classeId: classeA.id } });
      await prisma.coursClasse.create({ data: { coursId: coursA.id, classeId: classeB.id } });
      await prisma.coursClasse.create({ data: { coursId: coursB.id, classeId: classeA.id } });

      const result = await service.findAll(
        { ...PAGE_DEFAUT, coursId: coursA.id, classeId: classeA.id },
        ADMIN,
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(ccA.id);
      expect(result.meta.total).toBe(1);
    });

    // ── Pagination (BACK-02-B1) ─────────────────────────────────────────────

    it('page par défaut : meta cohérent avec le nombre réel d’enregistrements', async () => {
      const cours = await makeCoursScenarise();
      for (let i = 0; i < 3; i++) {
        const classe = await makeClasse();
        await prisma.coursClasse.create({ data: { coursId: cours.id, classeId: classe.id } });
      }

      const result = await service.findAll({ ...PAGE_DEFAUT }, ADMIN);

      expect(result.data).toHaveLength(3);
      expect(result.meta).toEqual({ total: 3, page: 1, limit: 20, totalPages: 1 });
    });

    it('dernière page partielle : totalPages arrondi au supérieur, data tronquée', async () => {
      const cours = await makeCoursScenarise();
      for (let i = 0; i < 5; i++) {
        const classe = await makeClasse();
        await prisma.coursClasse.create({ data: { coursId: cours.id, classeId: classe.id } });
      }

      const page3 = await service.findAll({ page: 3, limit: 2 }, ADMIN);

      expect(page3.data).toHaveLength(1);
      expect(page3.meta).toEqual({ total: 5, page: 3, limit: 2, totalPages: 3 });
    });

    it('collection vide : data vide et totalPages plancher à 1', async () => {
      const result = await service.findAll({ ...PAGE_DEFAUT }, ADMIN);

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 1 });
    });

    it('pagination + filtre : meta.total ne compte que les lignes filtrées', async () => {
      const coursA = await makeCoursScenarise();
      const coursB = await makeCoursScenarise();
      const classe1 = await makeClasse();
      const classe2 = await makeClasse();
      const classe3 = await makeClasse();
      await prisma.coursClasse.create({ data: { coursId: coursA.id, classeId: classe1.id } });
      await prisma.coursClasse.create({ data: { coursId: coursA.id, classeId: classe2.id } });
      await prisma.coursClasse.create({ data: { coursId: coursB.id, classeId: classe3.id } });

      const result = await service.findAll({ page: 1, limit: 1, coursId: coursA.id }, ADMIN);

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 2, page: 1, limit: 1, totalPages: 2 });
    });

    it('ENSEIGNANT : meta.total est borné par le scoping RBAC, pas par la table entière', async () => {
      const coursMien = await makeCoursScenarise();
      const coursAutre = await makeCoursScenarise();
      const classe1 = await makeClasse();
      const classe2 = await makeClasse();
      const classe3 = await makeClasse();
      await prisma.coursClasse.create({ data: { coursId: coursMien.id, classeId: classe1.id } });
      await prisma.coursClasse.create({ data: { coursId: coursMien.id, classeId: classe2.id } });
      await prisma.coursClasse.create({ data: { coursId: coursAutre.id, classeId: classe3.id } });

      // Retrouve le compte Utilisateur derrière l'enseignant propriétaire de coursMien.
      const enseignant = await prisma.enseignant.findUniqueOrThrow({
        where: { id: coursMien.enseignantId },
        select: { personnel: { select: { userId: true } } },
      });
      const teacher = { id: enseignant.personnel.userId, roles: ['ENSEIGNANT'] };

      const result = await service.findAll({ page: 1, limit: 1 }, teacher);

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 2, page: 1, limit: 1, totalPages: 2 });
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('retourne l’association si elle existe', async () => {
      const cours = await makeCoursScenarise();
      const classe = await makeClasse();
      const cc = await prisma.coursClasse.create({ data: { coursId: cours.id, classeId: classe.id } });

      const result = await service.findOne(cc.id);

      expect(result).toMatchObject({ id: cc.id, coursId: cours.id, classeId: classe.id });
    });

    it('lève NotFoundException si absente', async () => {
      await expect(service.findOne('00000000-0000-4000-8000-000000000000')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── create ────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('lève NotFoundException si le CoursScenarise est introuvable', async () => {
      const classe = await makeClasse();

      await expect(
        service.create({ coursId: '00000000-0000-4000-8000-000000000000', classeId: classe.id }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lève NotFoundException si la Classe est introuvable', async () => {
      const cours = await makeCoursScenarise();

      await expect(
        service.create({ coursId: cours.id, classeId: '00000000-0000-4000-8000-000000000000' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lève ConflictException avec le message métier exact si le cours n’est pas APPROUVE', async () => {
      const cours = await makeCoursScenarise(StatutValidation.EN_ATTENTE);
      const classe = await makeClasse();

      await expect(service.create({ coursId: cours.id, classeId: classe.id })).rejects.toMatchObject({
        message: 'Le cours doit être approuvé avant de pouvoir être associé à une classe.',
      });

      const rows = await prisma.coursClasse.findMany({ where: { coursId: cours.id } });
      expect(rows).toHaveLength(0);
    });

    it('lève ConflictException si l’association existe déjà', async () => {
      const cours = await makeCoursScenarise();
      const classe = await makeClasse();
      await prisma.coursClasse.create({ data: { coursId: cours.id, classeId: classe.id } });

      await expect(
        service.create({ coursId: cours.id, classeId: classe.id }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('crée réellement l’association en base quand toutes les règles sont respectées', async () => {
      const cours = await makeCoursScenarise();
      const classe = await makeClasse();

      const result = await service.create({ coursId: cours.id, classeId: classe.id });

      const persisted = await prisma.coursClasse.findUnique({ where: { id: result.id } });
      expect(persisted).not.toBeNull();
      expect(persisted).toMatchObject({ coursId: cours.id, classeId: classe.id });
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('lève NotFoundException si l’association est absente', async () => {
      await expect(service.remove('00000000-0000-4000-8000-000000000000')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lève ConflictException si des épreuves sont rattachées, et ne supprime rien', async () => {
      const cours = await makeCoursScenarise();
      const classe = await makeClasse();
      const cc = await prisma.coursClasse.create({ data: { coursId: cours.id, classeId: classe.id } });
      await prisma.epreuve.create({ data: { coursClasseId: cc.id, type: TypeEpreuve.CC } });

      await expect(service.remove(cc.id)).rejects.toBeInstanceOf(ConflictException);

      const stillThere = await prisma.coursClasse.findUnique({ where: { id: cc.id } });
      expect(stillThere).not.toBeNull();
    });

    it('supprime réellement l’association quand aucune épreuve n’y est rattachée', async () => {
      const cours = await makeCoursScenarise();
      const classe = await makeClasse();
      const cc = await prisma.coursClasse.create({ data: { coursId: cours.id, classeId: classe.id } });

      await service.remove(cc.id);

      const gone = await prisma.coursClasse.findUnique({ where: { id: cc.id } });
      expect(gone).toBeNull();
    });
  });
});
