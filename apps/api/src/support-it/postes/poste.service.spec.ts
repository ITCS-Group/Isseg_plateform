import { NotFoundException } from '@nestjs/common';
import { StatutPoste } from '@prisma/client';
import { PosteService } from './poste.service';

interface PrismaMock {
  poste: {
    create: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    groupBy: jest.Mock;
  };
}

const POSTE = {
  id: 'poste-1',
  salle: 'Salle A',
  statut: StatutPoste.DISPONIBLE,
  dateDerniereMaintenance: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('PosteService', () => {
  let service: PosteService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      poste: {
        create: jest.fn().mockResolvedValue(POSTE),
        findMany: jest.fn().mockResolvedValue([POSTE]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(POSTE),
        update: jest.fn().mockResolvedValue({ ...POSTE, statut: StatutPoste.HORS_SERVICE }),
        groupBy: jest.fn().mockResolvedValue([
          { salle: 'Salle A', statut: StatutPoste.DISPONIBLE, _count: { _all: 3 } },
          { salle: 'Salle A', statut: StatutPoste.HORS_SERVICE, _count: { _all: 1 } },
          { salle: 'Salle B', statut: StatutPoste.DISPONIBLE, _count: { _all: 2 } },
        ]),
      },
    };
    service = new PosteService(prisma as never);
  });

  it('create : crée le poste', async () => {
    const result = await service.create({ salle: 'Salle A' });
    expect(result.id).toBe('poste-1');
  });

  it('findAll : pagine avec skip/take et renvoie meta', async () => {
    prisma.poste.count.mockResolvedValue(42);
    const result = await service.findAll({ page: 2, limit: 10 });
    expect(prisma.poste.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(result.meta).toEqual({ total: 42, page: 2, limit: 10, totalPages: 5 });
  });

  it('findOne : introuvable → NotFoundException', async () => {
    prisma.poste.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateStatut : introuvable → NotFoundException', async () => {
    prisma.poste.findUnique.mockResolvedValue(null);
    await expect(service.updateStatut('missing', { statut: StatutPoste.HORS_SERVICE })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updateStatut : passage à DISPONIBLE horodate dateDerniereMaintenance', async () => {
    await service.updateStatut('poste-1', { statut: StatutPoste.DISPONIBLE });
    expect(prisma.poste.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statut: StatutPoste.DISPONIBLE, dateDerniereMaintenance: expect.any(Date) }),
      }),
    );
  });

  it('updateStatut : passage à HORS_SERVICE ne touche pas dateDerniereMaintenance', async () => {
    await service.updateStatut('poste-1', { statut: StatutPoste.HORS_SERVICE });
    expect(prisma.poste.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statut: StatutPoste.HORS_SERVICE, dateDerniereMaintenance: null }),
      }),
    );
  });

  it('disponibiliteParSalle : agrège correctement par salle', async () => {
    const result = await service.disponibiliteParSalle();
    expect(result).toEqual([
      { salle: 'Salle A', total: 4, disponibles: 3, horsService: 1 },
      { salle: 'Salle B', total: 2, disponibles: 2, horsService: 0 },
    ]);
  });
});
