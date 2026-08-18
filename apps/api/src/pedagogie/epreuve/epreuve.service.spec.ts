import { ConflictException, NotFoundException } from '@nestjs/common';
import { StatutValidation, TypeEpreuve } from '@prisma/client';
import { EpreuveService } from './epreuve.service';

// ── Mock Prisma ───────────────────────────────────────────────────────────────
interface PrismaMock {
  epreuve: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; delete: jest.Mock };
  coursClasse: { findUnique: jest.Mock };
  noteEtudiant: { count: jest.Mock };
}

const COURS_CLASSE_ID = 'cc-1';
const EPREUVE_ID = 'ep-1';

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

describe('EpreuveService', () => {
  let service: EpreuveService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      epreuve: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
      coursClasse: { findUnique: jest.fn() },
      noteEtudiant: { count: jest.fn() },
    };
    service = new EpreuveService(prisma as never);
  });

  // ── create ────────────────────────────────────────────────────────────────
  describe('create', () => {
    const input = { coursClasseId: COURS_CLASSE_ID, type: TypeEpreuve.CC };

    it('lève NotFoundException si le CoursClasse est introuvable', async () => {
      prisma.coursClasse.findUnique.mockResolvedValue(null);

      await expect(service.create(input)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.epreuve.create).not.toHaveBeenCalled();
    });

    it('lève une exception métier si le CoursScenarise n’est pas APPROUVE, sans écriture', async () => {
      prisma.coursClasse.findUnique.mockResolvedValue(
        makeCoursClasseWithCours(StatutValidation.EN_ATTENTE),
      );

      await expect(service.create(input)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.epreuve.create).not.toHaveBeenCalled();
    });

    it('crée l’Epreuve quand le cours est APPROUVE', async () => {
      prisma.coursClasse.findUnique.mockResolvedValue(makeCoursClasseWithCours());
      prisma.epreuve.create.mockResolvedValue(makeRow());

      const result = await service.create(input);

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

      const r1 = await service.create(input);
      const r2 = await service.create(input);

      expect(r1.id).toBe('ep-1');
      expect(r2.id).toBe('ep-2');
      expect(prisma.epreuve.create).toHaveBeenCalledTimes(2);
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('sans filtre', async () => {
      prisma.epreuve.findMany.mockResolvedValue([makeRow()]);

      const result = await service.findAll({});

      expect(prisma.epreuve.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { coursClasseId: undefined, type: undefined } }),
      );
      expect(result).toHaveLength(1);
    });

    it('filtre par coursClasseId', async () => {
      prisma.epreuve.findMany.mockResolvedValue([makeRow()]);

      await service.findAll({ coursClasseId: COURS_CLASSE_ID });

      expect(prisma.epreuve.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { coursClasseId: COURS_CLASSE_ID, type: undefined } }),
      );
    });

    it('filtre par type', async () => {
      prisma.epreuve.findMany.mockResolvedValue([makeRow()]);

      await service.findAll({ type: TypeEpreuve.TP });

      expect(prisma.epreuve.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { coursClasseId: undefined, type: TypeEpreuve.TP } }),
      );
    });

    it('combine coursClasseId et type', async () => {
      prisma.epreuve.findMany.mockResolvedValue([makeRow()]);

      await service.findAll({ coursClasseId: COURS_CLASSE_ID, type: TypeEpreuve.EXAMEN });

      expect(prisma.epreuve.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { coursClasseId: COURS_CLASSE_ID, type: TypeEpreuve.EXAMEN },
        }),
      );
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

      await expect(service.remove('absent')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.epreuve.delete).not.toHaveBeenCalled();
    });

    it('lève ConflictException si des NoteEtudiant sont rattachées, Epreuve conservée', async () => {
      prisma.epreuve.findUnique.mockResolvedValue(makeRow());
      prisma.noteEtudiant.count.mockResolvedValue(3);

      await expect(service.remove(EPREUVE_ID)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.epreuve.delete).not.toHaveBeenCalled();
    });

    it('supprime l’Epreuve quand aucune note n’y est rattachée', async () => {
      prisma.epreuve.findUnique.mockResolvedValue(makeRow());
      prisma.noteEtudiant.count.mockResolvedValue(0);
      prisma.epreuve.delete.mockResolvedValue(makeRow());

      await service.remove(EPREUVE_ID);

      expect(prisma.epreuve.delete).toHaveBeenCalledWith({ where: { id: EPREUVE_ID } });
    });
  });
});
