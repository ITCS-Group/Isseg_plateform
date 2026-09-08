import { NotFoundException } from '@nestjs/common';
import { PrismaClient, StatutPoste } from '@prisma/client';
import { createTestPrisma, truncateAll } from '../../../test/prisma-test-client';
import { AuditService } from '../../common/audit/audit.service';
import { PosteService } from './poste.service';

let prisma: PrismaClient;
/**
 * Acteur des mutations, RÉELLEMENT présent en base : `AuditLog.utilisateurId`
 * porte une clé étrangère vers `Utilisateur`.
 */
let acteurId: string;

beforeAll(() => {
  prisma = createTestPrisma();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await truncateAll(prisma);
  const acteur = await prisma.utilisateur.create({
    data: {
      nom: 'Responsable',
      prenom: 'IT',
      email: `acteur-audit-${Date.now()}-${Math.random()}@isseg-test.local`,
      motDePasseHash: 'hash-non-significatif',
      estActif: true,
    },
  });
  acteurId = acteur.id;
});

describe('Intégration — PosteService (isseg_test)', () => {
  it('create + findOne + findAll', async () => {
    const service = new PosteService(prisma as never, new AuditService());
    const created = await service.create({ salle: 'Salle A' }, acteurId);
    expect(created.statut).toBe(StatutPoste.DISPONIBLE);

    const found = await service.findOne(created.id);
    expect(found.salle).toBe('Salle A');

    const all = await service.findAll({ page: 1, limit: 20 });
    expect(all.data).toHaveLength(1);
    expect(all.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
  });

  it('findOne : introuvable → NotFoundException', async () => {
    const service = new PosteService(prisma as never, new AuditService());
    await expect(service.findOne('00000000-0000-0000-0000-000000000000')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updateStatut : HORS_SERVICE puis DISPONIBLE horodate la maintenance', async () => {
    const service = new PosteService(prisma as never, new AuditService());
    const created = await service.create({ salle: 'Salle A' }, acteurId);

    const horsService = await service.updateStatut(created.id, { statut: StatutPoste.HORS_SERVICE }, acteurId);
    expect(horsService.dateDerniereMaintenance).toBeNull();

    const disponible = await service.updateStatut(created.id, { statut: StatutPoste.DISPONIBLE }, acteurId);
    expect(disponible.dateDerniereMaintenance).not.toBeNull();
  });

  it('disponibiliteParSalle : agrège correctement à travers plusieurs salles', async () => {
    const service = new PosteService(prisma as never, new AuditService());
    await service.create({ salle: 'Salle A' }, acteurId);
    const p2 = await service.create({ salle: 'Salle A' }, acteurId);
    await service.updateStatut(p2.id, { statut: StatutPoste.HORS_SERVICE }, acteurId);
    await service.create({ salle: 'Salle B' }, acteurId);

    const result = await service.disponibiliteParSalle();
    expect(result).toEqual([
      { salle: 'Salle A', total: 2, disponibles: 1, horsService: 1 },
      { salle: 'Salle B', total: 1, disponibles: 1, horsService: 0 },
    ]);
  });
});
