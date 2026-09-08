import { ConflictException, NotFoundException } from '@nestjs/common';
import { StatutValidation, TypeEpreuve } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { EpreuveService } from './epreuve.service';

// ── Mock Prisma ───────────────────────────────────────────────────────────────
interface PrismaMock {
  epreuve: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  coursClasse: { findUnique: jest.Mock };
  noteEtudiant: { count: jest.Mock };
  auditLog: {
    create: jest.Mock;
  };
  /** Transaction interactive : le callback reçoit le mock lui-même. */
  $transaction: jest.Mock;
}

const COURS_CLASSE_ID = 'cc-1';
const EPREUVE_ID = 'ep-1';

/** Pagination par défaut (cf. PaginationDto) — évite de la répéter dans chaque appel. */
const PAGE_DEFAUT = { page: 1, limit: 20 };

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: EPREUVE_ID,
    coursClasseId: COURS_CLASSE_ID,
    type: TypeEpreuve.CC,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeCoursClasseWithCours(statutValidation: StatutValidation = StatutValidation.APPROUVE) {
  return {
    id: COURS_CLASSE_ID,
    coursId: 'c-1',
    classeId: 'cl-1',
    cours: { id: 'c-1', statutValidation },
  };
}

/** Acteur des mutations. Prisma est mocké : aucune contrainte de clé étrangère. */
const acteurId = 'acteur-1';

describe('EpreuveService', () => {
  let service: EpreuveService;
  let audit: AuditService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      epreuve: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
      coursClasse: { findUnique: jest.fn() },
      noteEtudiant: { count: jest.fn() },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    audit = new AuditService();
    jest.spyOn(audit, 'record');
    service = new EpreuveService(prisma as never, audit);
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

  // ── create ────────────────────────────────────────────────────────────────
  describe('create', () => {
    const input = { coursClasseId: COURS_CLASSE_ID, type: TypeEpreuve.CC };

    it('lève NotFoundException si le CoursClasse est introuvable', async () => {
      prisma.coursClasse.findUnique.mockResolvedValue(null);

      await expect(service.create(input, acteurId)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.epreuve.create).not.toHaveBeenCalled();
    });

    it('lève une exception métier si le CoursScenarise n’est pas APPROUVE, sans écriture', async () => {
      prisma.coursClasse.findUnique.mockResolvedValue(
        makeCoursClasseWithCours(StatutValidation.EN_ATTENTE),
      );

      await expect(service.create(input, acteurId)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.epreuve.create).not.toHaveBeenCalled();
    });

    it('crée l’Epreuve quand le cours est APPROUVE', async () => {
      prisma.coursClasse.findUnique.mockResolvedValue(makeCoursClasseWithCours());
      prisma.epreuve.create.mockResolvedValue(makeRow());

      const result = await service.create(input, acteurId);

      expect(prisma.epreuve.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { coursClasseId: COURS_CLASSE_ID, type: TypeEpreuve.CC } }),
      );
      expect(result.id).toBe(EPREUVE_ID);
    });

    it('autorise plusieurs Epreuves du même type pour un même CoursClasse (aucune unicité vérifiée)', async () => {
      prisma.coursClasse.findUnique.mockResolvedValue(makeCoursClasseWithCours());
      prisma.epreuve.create
        .mockResolvedValueOnce(makeRow({ id: 'ep-1' }))
        .mockResolvedValueOnce(makeRow({ id: 'ep-2' }));

      const r1 = await service.create(input, acteurId);
      const r2 = await service.create(input, acteurId);

      expect(r1.id).toBe('ep-1');
      expect(r2.id).toBe('ep-2');
      expect(prisma.epreuve.create).toHaveBeenCalledTimes(2);
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('sans filtre', async () => {
      prisma.epreuve.findMany.mockResolvedValue([makeRow()]);

      const result = await service.findAll({ ...PAGE_DEFAUT });

      expect(prisma.epreuve.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { coursClasseId: undefined, type: undefined } }),
      );
      expect(result.data).toHaveLength(1);
    });

    it('filtre par coursClasseId', async () => {
      prisma.epreuve.findMany.mockResolvedValue([makeRow()]);

      await service.findAll({ ...PAGE_DEFAUT, coursClasseId: COURS_CLASSE_ID });

      expect(prisma.epreuve.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { coursClasseId: COURS_CLASSE_ID, type: undefined } }),
      );
    });

    it('filtre par type', async () => {
      prisma.epreuve.findMany.mockResolvedValue([makeRow()]);

      await service.findAll({ ...PAGE_DEFAUT, type: TypeEpreuve.TP });

      expect(prisma.epreuve.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { coursClasseId: undefined, type: TypeEpreuve.TP } }),
      );
    });

    it('combine coursClasseId et type', async () => {
      prisma.epreuve.findMany.mockResolvedValue([makeRow()]);

      await service.findAll({
        ...PAGE_DEFAUT,
        coursClasseId: COURS_CLASSE_ID,
        type: TypeEpreuve.EXAMEN,
      });

      expect(prisma.epreuve.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { coursClasseId: COURS_CLASSE_ID, type: TypeEpreuve.EXAMEN },
        }),
      );
    });

    // ── Pagination ──────────────────────────────────────────────────────────

    it('page par défaut : renvoie {data, meta} avec skip=0/take=20', async () => {
      prisma.epreuve.findMany.mockResolvedValue([makeRow()]);
      prisma.epreuve.count.mockResolvedValue(1);

      const result = await service.findAll({ ...PAGE_DEFAUT });

      expect(prisma.epreuve.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
    });

    it('meta.total reflète le comptage réel filtré (count reçoit le même where)', async () => {
      prisma.epreuve.findMany.mockResolvedValue([makeRow()]);
      prisma.epreuve.count.mockResolvedValue(42);

      const result = await service.findAll({ ...PAGE_DEFAUT, type: TypeEpreuve.TP });

      expect(prisma.epreuve.count).toHaveBeenCalledWith({
        where: { coursClasseId: undefined, type: TypeEpreuve.TP },
      });
      expect(result.meta.total).toBe(42);
    });

    it('dernière page partielle : skip/take corrects et totalPages arrondi au supérieur', async () => {
      prisma.epreuve.findMany.mockResolvedValue([makeRow()]);
      prisma.epreuve.count.mockResolvedValue(41);

      const result = await service.findAll({ page: 3, limit: 20 });

      expect(prisma.epreuve.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
      expect(result.meta).toEqual({ total: 41, page: 3, limit: 20, totalPages: 3 });
      expect(result.data).toHaveLength(1);
    });

    it('collection vide : totalPages plancher à 1', async () => {
      prisma.epreuve.findMany.mockResolvedValue([]);
      prisma.epreuve.count.mockResolvedValue(0);

      const result = await service.findAll({ ...PAGE_DEFAUT });

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 1 });
    });

    it('pagination + filtre existant combinés', async () => {
      prisma.epreuve.findMany.mockResolvedValue([makeRow()]);
      prisma.epreuve.count.mockResolvedValue(7);

      const result = await service.findAll({
        page: 2,
        limit: 5,
        coursClasseId: COURS_CLASSE_ID,
      });

      expect(prisma.epreuve.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { coursClasseId: COURS_CLASSE_ID, type: undefined },
          skip: 5,
          take: 5,
        }),
      );
      expect(result.meta).toEqual({ total: 7, page: 2, limit: 5, totalPages: 2 });
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('retourne l’Epreuve si elle existe', async () => {
      prisma.epreuve.findUnique.mockResolvedValue(makeRow());

      const result = await service.findOne(EPREUVE_ID);

      expect(result.id).toBe(EPREUVE_ID);
    });

    it('lève NotFoundException si absente', async () => {
      prisma.epreuve.findUnique.mockResolvedValue(null);

      await expect(service.findOne('absent')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('lève NotFoundException si l’Epreuve est absente', async () => {
      prisma.epreuve.findUnique.mockResolvedValue(null);

      await expect(service.remove('absent', acteurId)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.epreuve.delete).not.toHaveBeenCalled();
    });

    it('lève ConflictException si des NoteEtudiant sont rattachées, Epreuve conservée', async () => {
      prisma.epreuve.findUnique.mockResolvedValue(makeRow());
      prisma.noteEtudiant.count.mockResolvedValue(3);

      await expect(service.remove(EPREUVE_ID, acteurId)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.epreuve.delete).not.toHaveBeenCalled();
    });

    it('supprime l’Epreuve quand aucune note n’y est rattachée', async () => {
      prisma.epreuve.findUnique.mockResolvedValue(makeRow());
      prisma.noteEtudiant.count.mockResolvedValue(0);
      prisma.epreuve.delete.mockResolvedValue(makeRow());

      await service.remove(EPREUVE_ID, acteurId);

      expect(prisma.epreuve.delete).toHaveBeenCalledWith({ where: { id: EPREUVE_ID } });
    });
  });

  // ── Audit métier (BACK-01, lot 4) ──────────────────────────────────────────

  describe('audit métier', () => {
    it('create : CREATE sur l\'épreuve, attribué à l\'acteur', async () => {
      prisma.coursClasse.findUnique.mockResolvedValue({
        id: 'cc-1',
        cours: { statutValidation: 'APPROUVE' },
      });
      prisma.epreuve.create.mockResolvedValue({ id: 'ep-1', coursClasseId: 'cc-1', type: 'CC' });
      await service.create({ coursClasseId: 'cc-1', type: 'CC' } as never, acteurId);

      const e = dernierAudit();
      expect(e.action).toBe('CREATE');
      expect(e.entity).toBe('Epreuve');
      expect(e.actorId).toBe(acteurId);
      expect(e.details).toMatchObject({ coursClasseId: 'cc-1' });
    });

    it('remove : DELETE conservant le type capturé avant suppression', async () => {
      prisma.epreuve.findUnique.mockResolvedValue({ id: 'ep-1', coursClasseId: 'cc-1', type: 'CC' });
      prisma.noteEtudiant.count.mockResolvedValue(0);
      await service.remove('ep-1', acteurId);

      const e = dernierAudit();
      expect(e.action).toBe('DELETE');
      expect(e.entity).toBe('Epreuve');
      expect(e.entityId).toBe('ep-1');
    });

    it('l\'audit passe par le client de la transaction', async () => {
      prisma.epreuve.findUnique.mockResolvedValue({ id: 'ep-1', coursClasseId: 'cc-1', type: 'CC' });
      prisma.noteEtudiant.count.mockResolvedValue(0);
      await service.remove('ep-1', acteurId);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(clientDuDernierAudit()).toBe(prisma);
    });

    it('un refus métier avant la transaction n\'écrit aucun audit', async () => {
      prisma.noteEtudiant.count.mockResolvedValue(5);

      await expect(service.remove('ep-1', acteurId)).rejects.toBeDefined();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });
});
