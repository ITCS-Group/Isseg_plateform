import { NotFoundException } from '@nestjs/common';
import { PrismaClient, StatutPoste } from '@prisma/client';
import { createTestPrisma, truncateAll } from '../../../test/prisma-test-client';
import { PosteService } from './poste.service';

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

describe('Intégration — PosteService (isseg_test)', () => {
  it('create + findOne + findAll', async () => {
    const service = new PosteService(prisma as never);
    const created = await service.create({ salle: 'Salle A' });
    expect(created.statut).toBe(StatutPoste.DISPONIBLE);

    const found = await service.findOne(created.id);
    expect(found.salle).toBe('Salle A');

    const all = await service.findAll({});
    expect(all).toHaveLength(1);
  });

  it('findOne : introuvable → NotFoundException', async () => {
    const service = new PosteService(prisma as never);
    await expect(service.findOne('00000000-0000-0000-0000-000000000000')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updateStatut : HORS_SERVICE puis DISPONIBLE horodate la maintenance', async () => {
    const service = new PosteService(prisma as never);
    const created = await service.create({ salle: 'Salle A' });

    const horsService = await service.updateStatut(created.id, { statut: StatutPoste.HORS_SERVICE });
    expect(horsService.dateDerniereMaintenance).toBeNull();

    const disponible = await service.updateStatut(created.id, { statut: StatutPoste.DISPONIBLE });
    expect(disponible.dateDerniereMaintenance).not.toBeNull();
  });

  it('disponibiliteParSalle : agrège correctement à travers plusieurs salles', async () => {
    const service = new PosteService(prisma as never);
    await service.create({ salle: 'Salle A' });
    const p2 = await service.create({ salle: 'Salle A' });
    await service.updateStatut(p2.id, { statut: StatutPoste.HORS_SERVICE });
    await service.create({ salle: 'Salle B' });

    const result = await service.disponibiliteParSalle();
    expect(result).toEqual([
      { salle: 'Salle A', total: 2, disponibles: 1, horsService: 1 },
      { salle: 'Salle B', total: 1, disponibles: 1, horsService: 0 },
    ]);
  });
});
