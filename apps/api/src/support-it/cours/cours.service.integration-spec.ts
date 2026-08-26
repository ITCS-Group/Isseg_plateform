import { NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createTestPrisma, truncateAll } from '../../../test/prisma-test-client';
import { CoursSupportITService } from './cours.service';

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createTestPrisma();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await truncateAll(prisma);
});

describe('Intégration — CoursSupportITService (isseg_test)', () => {
  it('create + findOne + findAll', async () => {
    const service = new CoursSupportITService(prisma as never);

    const created = await service.create({
      titre: 'Bureautique niveau 1',
      contenu: 'Word, Excel, PowerPoint',
      niveau: 'Débutant',
      duree: 120,
    });

    const found = await service.findOne(created.id);
    expect(found.titre).toBe('Bureautique niveau 1');

    const all = await service.findAll({ page: 1, limit: 20 });
    expect(all.data).toHaveLength(1);
    expect(all.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
  });

  it('findOne : introuvable → NotFoundException', async () => {
    const service = new CoursSupportITService(prisma as never);
    await expect(service.findOne('00000000-0000-0000-0000-000000000000')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
