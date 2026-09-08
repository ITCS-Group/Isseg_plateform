import { ConflictException, NotFoundException } from '@nestjs/common';
import { StatutValidation } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { CoursClasseService } from './cours-classe.service';

// ── Mock Prisma ───────────────────────────────────────────────────────────────
interface PrismaMock {
  coursClasse: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  coursScenarise: { findUnique: jest.Mock };
  classe: { findUnique: jest.Mock };
  epreuve: { count: jest.Mock };
  enseignant: { findFirst: jest.Mock };
  auditLog: {
    create: jest.Mock;
  };
  /** Transaction interactive : le callback reçoit le mock lui-même. */
  $transaction: jest.Mock;
}

const COURS_ID = 'cours-1';
const CLASSE_ID = 'classe-1';
const ASSOCIATION_ID = 'cc-1';
const ADMIN_USER = { id: 'admin-1', roles: ['ADMIN'] };
const TEACHER_USER = { id: 'teacher-1', roles: ['ENSEIGNANT'] };

/** Pagination par défaut (cf. PaginationDto) — évite de la répéter dans chaque appel. */
const PAGE_DEFAUT = { page: 1, limit: 20 };

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ASSOCIATION_ID,
    coursId: COURS_ID,
    classeId: CLASSE_ID,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    cours: { codeCours: 'SEDU-L3-S1-101', titre: 'Psychologie de l’Éducation' },
    classe: { codeClasse: 'SEDU-L3-A', libelle: 'Licence 3 Section A', niveau: 'L3' },
    ...overrides,
  };
}

function makeDto(overrides: Record<string, unknown> = {}) {
  return {
    id: ASSOCIATION_ID,
    coursId: COURS_ID,
    classeId: CLASSE_ID,
    createdAt: makeRow().createdAt,
    coursCode: 'SEDU-L3-S1-101',
    coursTitre: 'Psychologie de l’Éducation',
    classeCode: 'SEDU-L3-A',
    classeLibelle: 'Licence 3 Section A',
    classeNiveau: 'L3',
    ...overrides,
  };
}

/** Acteur des mutations. Prisma est mocké : aucune contrainte de clé étrangère. */
const acteurId = 'acteur-1';

describe('CoursClasseService', () => {
  let service: CoursClasseService;
  let audit: AuditService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      coursClasse: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
      coursScenarise: { findUnique: jest.fn() },
      classe: { findUnique: jest.fn() },
      epreuve: { count: jest.fn() },
      enseignant: { findFirst: jest.fn() },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    audit = new AuditService();
    jest.spyOn(audit, 'record');
    service = new CoursClasseService(prisma as never, audit);
  });

  /** Dernière entrée soumise à AuditService, et client utilisé pour l'écrire. */
  function dernierAudit() {
    const appels = (audit.record as jest.Mock).mock.calls;
    return appels[appels.length - 1][1];
  }
  function clientDuDernierAudit() {
    const appels = (audit.record as jest.Mock).mock.calls;
    return appels[appels.length - 1][0];
  }

  // ── findAll ───────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('ADMIN : transmet les filtres coursId/classeId à Prisma et mappe les résultats enrichis', async () => {
      prisma.coursClasse.findMany.mockResolvedValue([makeRow()]);

      const result = await service.findAll(
        { ...PAGE_DEFAUT, coursId: COURS_ID, classeId: undefined },
        ADMIN_USER,
      );

      expect(prisma.coursClasse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { coursId: COURS_ID, classeId: undefined },
        }),
      );
      expect(result.data).toEqual([makeDto()]);
    });

    it('ADMIN avec enseignantId fourni : le filtre est transmis tel quel', async () => {
      prisma.coursClasse.findMany.mockResolvedValue([]);

      await service.findAll({ ...PAGE_DEFAUT, enseignantId: 'ens-42' }, ADMIN_USER);

      expect(prisma.coursClasse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ cours: { enseignantId: 'ens-42' } }),
        }),
      );
    });

    it('ENSEIGNANT : forcé sur son propre id, un enseignantId fourni est ignoré', async () => {
      prisma.enseignant.findFirst.mockResolvedValue({ id: 'ens-self' });
      prisma.coursClasse.findMany.mockResolvedValue([]);

      await service.findAll({ ...PAGE_DEFAUT, enseignantId: 'ens-autre' }, TEACHER_USER);

      expect(prisma.enseignant.findFirst).toHaveBeenCalledWith({
        where: { personnel: { userId: TEACHER_USER.id } },
        select: { id: true },
      });
      expect(prisma.coursClasse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ cours: { enseignantId: 'ens-self' } }),
        }),
      );
    });

    it('ENSEIGNANT sans fiche Enseignant liée : liste vide, aucun appel findMany', async () => {
      prisma.enseignant.findFirst.mockResolvedValue(null);

      const result = await service.findAll({ ...PAGE_DEFAUT }, TEACHER_USER);

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 1 });
      expect(prisma.coursClasse.findMany).not.toHaveBeenCalled();
      expect(prisma.coursClasse.count).not.toHaveBeenCalled();
    });

    // ── Pagination ──────────────────────────────────────────────────────────

    it('page par défaut : renvoie {data, meta} avec skip=0/take=20', async () => {
      prisma.coursClasse.findMany.mockResolvedValue([makeRow()]);
      prisma.coursClasse.count.mockResolvedValue(1);

      const result = await service.findAll({ ...PAGE_DEFAUT }, ADMIN_USER);

      expect(prisma.coursClasse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
    });

    it('meta.total reflète le comptage réel filtré (count reçoit le même where)', async () => {
      prisma.coursClasse.findMany.mockResolvedValue([makeRow()]);
      prisma.coursClasse.count.mockResolvedValue(42);

      const result = await service.findAll({ ...PAGE_DEFAUT, coursId: COURS_ID }, ADMIN_USER);

      expect(prisma.coursClasse.count).toHaveBeenCalledWith({
        where: { coursId: COURS_ID, classeId: undefined },
      });
      expect(result.meta.total).toBe(42);
    });

    it('dernière page partielle : skip/take corrects et totalPages arrondi au supérieur', async () => {
      prisma.coursClasse.findMany.mockResolvedValue([makeRow()]);
      prisma.coursClasse.count.mockResolvedValue(41);

      const result = await service.findAll({ page: 3, limit: 20 }, ADMIN_USER);

      expect(prisma.coursClasse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
      expect(result.meta).toEqual({ total: 41, page: 3, limit: 20, totalPages: 3 });
      expect(result.data).toHaveLength(1);
    });

    it('collection vide : totalPages plancher à 1', async () => {
      prisma.coursClasse.findMany.mockResolvedValue([]);
      prisma.coursClasse.count.mockResolvedValue(0);

      const result = await service.findAll({ ...PAGE_DEFAUT }, ADMIN_USER);

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 1 });
    });

    it('pagination + filtres existants combinés', async () => {
      prisma.coursClasse.findMany.mockResolvedValue([makeRow()]);
      prisma.coursClasse.count.mockResolvedValue(7);

      const result = await service.findAll(
        { page: 2, limit: 5, coursId: COURS_ID, classeId: CLASSE_ID },
        ADMIN_USER,
      );

      expect(prisma.coursClasse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { coursId: COURS_ID, classeId: CLASSE_ID },
          skip: 5,
          take: 5,
        }),
      );
      expect(result.meta).toEqual({ total: 7, page: 2, limit: 5, totalPages: 2 });
    });

    it('ENSEIGNANT : le scoping RBAC est appliqué au findMany ET au count', async () => {
      prisma.enseignant.findFirst.mockResolvedValue({ id: 'ens-self' });
      prisma.coursClasse.findMany.mockResolvedValue([makeRow()]);
      prisma.coursClasse.count.mockResolvedValue(3);

      const result = await service.findAll(
        { page: 1, limit: 2, enseignantId: 'ens-autre' },
        TEACHER_USER,
      );

      const expectedWhere = {
        coursId: undefined,
        classeId: undefined,
        cours: { enseignantId: 'ens-self' },
      };
      expect(prisma.coursClasse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere, skip: 0, take: 2 }),
      );
      expect(prisma.coursClasse.count).toHaveBeenCalledWith({ where: expectedWhere });
      expect(result.meta).toEqual({ total: 3, page: 1, limit: 2, totalPages: 2 });
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('retourne le DTO si l’association existe', async () => {
      prisma.coursClasse.findUnique.mockResolvedValue(makeRow());

      const result = await service.findOne(ASSOCIATION_ID);

      expect(result.id).toBe(ASSOCIATION_ID);
    });

    it('lève NotFoundException si l’association est absente', async () => {
      prisma.coursClasse.findUnique.mockResolvedValue(null);

      await expect(service.findOne('absent')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────
  describe('create', () => {
    const dto = { coursId: COURS_ID, classeId: CLASSE_ID };

    it('lève NotFoundException si le CoursScenarise est introuvable', async () => {
      prisma.coursScenarise.findUnique.mockResolvedValue(null);

      await expect(service.create(dto, acteurId)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.classe.findUnique).not.toHaveBeenCalled();
      expect(prisma.coursClasse.create).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si la Classe est introuvable', async () => {
      prisma.coursScenarise.findUnique.mockResolvedValue({
        id: COURS_ID,
        statutValidation: StatutValidation.APPROUVE,
      });
      prisma.classe.findUnique.mockResolvedValue(null);

      await expect(service.create(dto, acteurId)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.coursClasse.create).not.toHaveBeenCalled();
    });

    it('lève ConflictException avec le message métier exact si le cours n’est pas APPROUVE', async () => {
      prisma.coursScenarise.findUnique.mockResolvedValue({
        id: COURS_ID,
        statutValidation: StatutValidation.EN_ATTENTE,
      });
      prisma.classe.findUnique.mockResolvedValue({ id: CLASSE_ID });

      await expect(service.create(dto, acteurId)).rejects.toMatchObject({
        message: 'Le cours doit être approuvé avant de pouvoir être associé à une classe.',
      });
      expect(prisma.coursClasse.create).not.toHaveBeenCalled();
    });

    it('lève ConflictException si l’association existe déjà', async () => {
      prisma.coursScenarise.findUnique.mockResolvedValue({
        id: COURS_ID,
        statutValidation: StatutValidation.APPROUVE,
      });
      prisma.classe.findUnique.mockResolvedValue({ id: CLASSE_ID });
      prisma.coursClasse.findUnique.mockResolvedValue(makeRow());

      await expect(service.create(dto, acteurId)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.coursClasse.create).not.toHaveBeenCalled();
    });

    it('crée l’association quand toutes les règles sont respectées', async () => {
      prisma.coursScenarise.findUnique.mockResolvedValue({
        id: COURS_ID,
        statutValidation: StatutValidation.APPROUVE,
      });
      prisma.classe.findUnique.mockResolvedValue({ id: CLASSE_ID });
      prisma.coursClasse.findUnique.mockResolvedValue(null);
      prisma.coursClasse.create.mockResolvedValue(makeRow());

      const result = await service.create(dto, acteurId);

      expect(prisma.coursClasse.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { coursId: COURS_ID, classeId: CLASSE_ID } }),
      );
      expect(result.id).toBe(ASSOCIATION_ID);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('lève NotFoundException si l’association est absente', async () => {
      prisma.coursClasse.findUnique.mockResolvedValue(null);

      await expect(service.remove('absent', acteurId)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.coursClasse.delete).not.toHaveBeenCalled();
    });

    it('lève ConflictException si des épreuves sont encore rattachées', async () => {
      prisma.coursClasse.findUnique.mockResolvedValue(makeRow());
      prisma.epreuve.count.mockResolvedValue(2);

      await expect(service.remove(ASSOCIATION_ID, acteurId)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.coursClasse.delete).not.toHaveBeenCalled();
    });

    it('supprime l’association quand aucune épreuve n’y est rattachée', async () => {
      prisma.coursClasse.findUnique.mockResolvedValue(makeRow());
      prisma.epreuve.count.mockResolvedValue(0);
      prisma.coursClasse.delete.mockResolvedValue(makeRow());

      await service.remove(ASSOCIATION_ID, acteurId);

      expect(prisma.coursClasse.delete).toHaveBeenCalledWith({ where: { id: ASSOCIATION_ID } });
    });
  });

  // ── Audit métier (BACK-01, lot 4) ──────────────────────────────────────────

  describe('audit métier', () => {
    it('create : CREATE sur l\'association, attribué à l\'acteur', async () => {
      prisma.coursScenarise.findUnique.mockResolvedValue({ id: 'cours-1', statutValidation: 'APPROUVE' });
      prisma.classe.findUnique.mockResolvedValue({ id: 'classe-1' });
      prisma.coursClasse.findUnique.mockResolvedValue(null);
      prisma.coursClasse.create.mockResolvedValue({
        id: 'cc-1',
        coursId: 'cours-1',
        classeId: 'classe-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        cours: { codeCours: 'SEDU-101', titre: 'Cours', enseignantId: 'ens-1' },
        classe: { codeClasse: 'L3-A', libelle: 'Licence 3 A', niveau: 'L3' },
      });
      await service.create({ coursId: 'cours-1', classeId: 'classe-1' } as never, acteurId);

      const e = dernierAudit();
      expect(e.action).toBe('CREATE');
      expect(e.entity).toBe('CoursClasse');
      expect(e.actorId).toBe(acteurId);
      expect(e.details).toMatchObject({ coursId: 'cours-1', classeId: 'classe-1' });
    });

    it('remove : DELETE conservant cours et classe capturés avant suppression', async () => {
      prisma.coursClasse.findUnique.mockResolvedValue({ id: 'cc-1', coursId: 'cours-1', classeId: 'classe-1' });
      prisma.epreuve.count.mockResolvedValue(0);
      await service.remove('cc-1', acteurId);

      const e = dernierAudit();
      expect(e.action).toBe('DELETE');
      expect(e.entity).toBe('CoursClasse');
      expect(e.entityId).toBe('cc-1');
    });

    it('l\'audit passe par le client de la transaction', async () => {
      prisma.coursClasse.findUnique.mockResolvedValue({ id: 'cc-1', coursId: 'cours-1', classeId: 'classe-1' });
      prisma.epreuve.count.mockResolvedValue(0);
      await service.remove('cc-1', acteurId);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(clientDuDernierAudit()).toBe(prisma);
    });

    it('un refus métier avant la transaction n\'écrit aucun audit', async () => {
      prisma.epreuve.count.mockResolvedValue(3);

      await expect(service.remove('cc-1', acteurId)).rejects.toBeDefined();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });
});
