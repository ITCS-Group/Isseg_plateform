import { ConflictException, NotFoundException } from '@nestjs/common';
import { TypeAbonne } from '@prisma/client';
import { AbonneService } from './abonne.service';

interface PrismaMock {
  utilisateur: { findUnique: jest.Mock };
  abonne: { findUnique: jest.Mock; create: jest.Mock; findMany: jest.Mock; count: jest.Mock };
}

/** Pagination par défaut (cf. PaginationDto) — page 1, 20 éléments. */
const PAGE_DEFAUT = { page: 1, limit: 20 };

const ABONNE_ROW = {
  id: 'ab-1',
  utilisateurId: 'user-1',
  typeAbonne: TypeAbonne.ENSEIGNANT,
  dateDebut: new Date(),
  dateFin: null,
  statutActif: true,
  limiteEmprunts: 10,
  dureePretJours: 30,
  createdAt: new Date(),
  updatedAt: new Date(),
  utilisateur: { nom: 'N', prenom: 'P' },
};

describe('AbonneService', () => {
  let service: AbonneService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      utilisateur: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', nom: 'N', prenom: 'P' }) },
      abonne: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(ABONNE_ROW),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    service = new AbonneService(prisma as never);
  });

  it('utilisateur introuvable → NotFoundException', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue(null);
    await expect(
      service.create({ utilisateurId: 'x', typeAbonne: TypeAbonne.ENSEIGNANT }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('utilisateur déjà abonné → ConflictException', async () => {
    prisma.abonne.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(
      service.create({ utilisateurId: 'user-1', typeAbonne: TypeAbonne.ENSEIGNANT }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('création : limiteEmprunts/dureePretJours dérivés du TypeAbonne (ENSEIGNANT → 10/30)', async () => {
    await service.create({ utilisateurId: 'user-1', typeAbonne: TypeAbonne.ENSEIGNANT });

    expect(prisma.abonne.create.mock.calls[0][0].data).toMatchObject({
      utilisateurId: 'user-1',
      typeAbonne: TypeAbonne.ENSEIGNANT,
      limiteEmprunts: 10,
      dureePretJours: 30,
    });
  });

  // ── findAll — pagination (BACK-02-A) ────────────────────────────────────────
  describe('findAll — pagination', () => {
    it('page par défaut : renvoie {data, meta} avec skip=0/take=20', async () => {
      prisma.abonne.findMany.mockResolvedValue([ABONNE_ROW]);
      prisma.abonne.count.mockResolvedValue(1);

      const result = await service.findAll({ ...PAGE_DEFAUT });

      expect(prisma.abonne.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
    });

    it('meta.total reflète le comptage réel de la table', async () => {
      prisma.abonne.findMany.mockResolvedValue([ABONNE_ROW]);
      prisma.abonne.count.mockResolvedValue(120);

      const result = await service.findAll({ ...PAGE_DEFAUT });

      expect(prisma.abonne.count).toHaveBeenCalled();
      expect(result.meta).toEqual({ total: 120, page: 1, limit: 20, totalPages: 6 });
    });

    it('dernière page partielle : skip/take corrects, totalPages arrondi au supérieur', async () => {
      prisma.abonne.findMany.mockResolvedValue([ABONNE_ROW]);
      prisma.abonne.count.mockResolvedValue(41);

      const result = await service.findAll({ page: 3, limit: 20 });

      expect(prisma.abonne.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
      expect(result.meta).toEqual({ total: 41, page: 3, limit: 20, totalPages: 3 });
      expect(result.data).toHaveLength(1);
    });

    it('collection vide : totalPages plancher à 1', async () => {
      prisma.abonne.findMany.mockResolvedValue([]);
      prisma.abonne.count.mockResolvedValue(0);

      const result = await service.findAll({ ...PAGE_DEFAUT });

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 1 });
    });

    it('limit personnalisé : skip/take suivent la page demandée', async () => {
      prisma.abonne.findMany.mockResolvedValue([ABONNE_ROW]);
      prisma.abonne.count.mockResolvedValue(7);

      const result = await service.findAll({ page: 2, limit: 3 });

      expect(prisma.abonne.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 3, take: 3 }),
      );
      expect(result.meta).toEqual({ total: 7, page: 2, limit: 3, totalPages: 3 });
    });
  });
});
