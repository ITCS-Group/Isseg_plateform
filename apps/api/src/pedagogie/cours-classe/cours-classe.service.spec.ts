import { ConflictException, NotFoundException } from '@nestjs/common';
import { StatutValidation } from '@prisma/client';
import { CoursClasseService } from './cours-classe.service';

// ── Mock Prisma ───────────────────────────────────────────────────────────────
interface PrismaMock {
  coursClasse: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  coursScenarise: { findUnique: jest.Mock };
  classe: { findUnique: jest.Mock };
  epreuve: { count: jest.Mock };
  enseignant: { findFirst: jest.Mock };
}

const COURS_ID = 'cours-1';
const CLASSE_ID = 'classe-1';
const ASSOCIATION_ID = 'cc-1';
const ADMIN_USER = { id: 'admin-1', roles: ['ADMIN'] };
const TEACHER_USER = { id: 'teacher-1', roles: ['ENSEIGNANT'] };

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

describe('CoursClasseService', () => {
  let service: CoursClasseService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      coursClasse: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      coursScenarise: { findUnique: jest.fn() },
      classe: { findUnique: jest.fn() },
      epreuve: { count: jest.fn() },
      enseignant: { findFirst: jest.fn() },
    };
    service = new CoursClasseService(prisma as never);
  });

  // ── findAll ───────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('ADMIN : transmet les filtres coursId/classeId à Prisma et mappe les résultats enrichis', async () => {
      prisma.coursClasse.findMany.mockResolvedValue([makeRow()]);

      const result = await service.findAll({ coursId: COURS_ID, classeId: undefined }, ADMIN_USER);

      expect(prisma.coursClasse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { coursId: COURS_ID, classeId: undefined },
        }),
      );
      expect(result).toEqual([makeDto()]);
    });

    it('ADMIN avec enseignantId fourni : le filtre est transmis tel quel', async () => {
      prisma.coursClasse.findMany.mockResolvedValue([]);

      await service.findAll({ enseignantId: 'ens-42' }, ADMIN_USER);

      expect(prisma.coursClasse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ cours: { enseignantId: 'ens-42' } }),
        }),
      );
    });

    it('ENSEIGNANT : forcé sur son propre id, un enseignantId fourni est ignoré', async () => {
      prisma.enseignant.findFirst.mockResolvedValue({ id: 'ens-self' });
      prisma.coursClasse.findMany.mockResolvedValue([]);

      await service.findAll({ enseignantId: 'ens-autre' }, TEACHER_USER);

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

      const result = await service.findAll({}, TEACHER_USER);

      expect(result).toEqual([]);
      expect(prisma.coursClasse.findMany).not.toHaveBeenCalled();
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

      await expect(service.create(dto)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.classe.findUnique).not.toHaveBeenCalled();
      expect(prisma.coursClasse.create).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si la Classe est introuvable', async () => {
      prisma.coursScenarise.findUnique.mockResolvedValue({
        id: COURS_ID,
        statutValidation: StatutValidation.APPROUVE,
      });
      prisma.classe.findUnique.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.coursClasse.create).not.toHaveBeenCalled();
    });

    it('lève ConflictException avec le message métier exact si le cours n’est pas APPROUVE', async () => {
      prisma.coursScenarise.findUnique.mockResolvedValue({
        id: COURS_ID,
        statutValidation: StatutValidation.EN_ATTENTE,
      });
      prisma.classe.findUnique.mockResolvedValue({ id: CLASSE_ID });

      await expect(service.create(dto)).rejects.toMatchObject({
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

      await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
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

      const result = await service.create(dto);

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

      await expect(service.remove('absent')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.coursClasse.delete).not.toHaveBeenCalled();
    });

    it('lève ConflictException si des épreuves sont encore rattachées', async () => {
      prisma.coursClasse.findUnique.mockResolvedValue(makeRow());
      prisma.epreuve.count.mockResolvedValue(2);

      await expect(service.remove(ASSOCIATION_ID)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.coursClasse.delete).not.toHaveBeenCalled();
    });

    it('supprime l’association quand aucune épreuve n’y est rattachée', async () => {
      prisma.coursClasse.findUnique.mockResolvedValue(makeRow());
      prisma.epreuve.count.mockResolvedValue(0);
      prisma.coursClasse.delete.mockResolvedValue(makeRow());

      await service.remove(ASSOCIATION_ID);

      expect(prisma.coursClasse.delete).toHaveBeenCalledWith({ where: { id: ASSOCIATION_ID } });
    });
  });
});
