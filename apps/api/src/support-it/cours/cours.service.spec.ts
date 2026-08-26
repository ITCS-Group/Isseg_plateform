import { NotFoundException } from '@nestjs/common';
import { CoursSupportITService } from './cours.service';

interface PrismaMock {
  coursSupportIT: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
}

const COURS = {
  id: 'cours-1',
  titre: 'Bureautique niveau 1',
  contenu: 'Word, Excel, PowerPoint',
  niveau: 'Débutant',
  duree: 120,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CoursSupportITService', () => {
  let service: CoursSupportITService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      coursSupportIT: {
        create: jest.fn().mockResolvedValue(COURS),
        findMany: jest.fn().mockResolvedValue([COURS]),
        findUnique: jest.fn().mockResolvedValue(COURS),
      },
    };
    service = new CoursSupportITService(prisma as never);
  });

  it('create : crée le cours', async () => {
    const result = await service.create({
      titre: 'Bureautique niveau 1',
      contenu: 'Word, Excel, PowerPoint',
      niveau: 'Débutant',
      duree: 120,
    });
    expect(result.id).toBe('cours-1');
  });

  it('findAll : retourne la liste', async () => {
    const result = await service.findAll();
    expect(result).toHaveLength(1);
  });

  it('findOne : introuvable → NotFoundException', async () => {
    prisma.coursSupportIT.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
