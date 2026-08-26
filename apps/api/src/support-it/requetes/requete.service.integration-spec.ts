import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { NatureRequete, PrismaClient, SousServiceIT, StatutRequete } from '@prisma/client';
import { createTestPrisma, truncateAll } from '../../../test/prisma-test-client';
import type { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import { RequeteService } from './requete.service';

let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${seq++}`;

let prisma: PrismaClient;

async function makePersonnel() {
  const user = await prisma.utilisateur.create({
    data: { nom: 'Bah', prenom: 'Mamadou', email: uid('pers') + '@t.local', motDePasseHash: 'x' },
  });
  const personnel = await prisma.personnel.create({
    data: {
      userId: user.id,
      matricule: uid('PERS'),
      poste: 'Enseignant',
      dateEmbauche: new Date(Date.UTC(2020, 0, 1)),
      salaire: 0,
    },
  });
  return { user, personnel };
}

async function makeTechnicien(sousService: SousServiceIT) {
  const { user, personnel } = await makePersonnel();
  const technicien = await prisma.technicien.create({
    data: { personnelId: personnel.id, sousService },
  });
  return { user, personnel, technicien };
}

function toAuthUser(userId: string, roles: string[]): AuthenticatedUser {
  return {
    id: userId,
    email: 'x@t.local',
    nom: 'Test',
    prenom: 'Test',
    estActif: true,
    roles,
    permissions: [],
  };
}

beforeAll(() => {
  prisma = createTestPrisma();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await truncateAll(prisma);
});

describe('Intégration — RequeteService (isseg_test)', () => {
  it('création : route automatiquement PANNE_MATERIEL vers MAINTENANCE', async () => {
    const service = new RequeteService(prisma as never);
    const { user } = await makePersonnel();

    const result = await service.create(
      { nature: NatureRequete.PANNE_MATERIEL, description: 'Écran cassé en salle B12' },
      user.id,
    );

    expect(result.sousServiceCible).toBe(SousServiceIT.MAINTENANCE);
    expect(result.statut).toBe(StatutRequete.OUVERTE);

    const row = await prisma.requete.findUniqueOrThrow({ where: { id: result.id } });
    expect(row.demandeurId).not.toBeNull();
  });

  it('création : compte sans profil Personnel → ForbiddenException, rien en base', async () => {
    const service = new RequeteService(prisma as never);
    const user = await prisma.utilisateur.create({
      data: { nom: 'Sans', prenom: 'Personnel', email: uid('np') + '@t.local', motDePasseHash: 'x' },
    });

    await expect(
      service.create({ nature: NatureRequete.AUTRE, description: 'Une requête quelconque' }, user.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(await prisma.requete.count()).toBe(0);
  });

  it('findAll : le demandeur ne voit que ses propres requêtes', async () => {
    const service = new RequeteService(prisma as never);
    const { user: demandeurA } = await makePersonnel();
    const { user: demandeurB } = await makePersonnel();

    await service.create({ nature: NatureRequete.AUTRE, description: 'Requête de A' }, demandeurA.id);
    await service.create({ nature: NatureRequete.AUTRE, description: 'Requête de B' }, demandeurB.id);

    const result = await service.findAll({}, toAuthUser(demandeurA.id, ['ENSEIGNANT']));
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Requête de A');
  });

  it('findAll : TECHNICIEN ne voit que les requêtes de son sous-service', async () => {
    const service = new RequeteService(prisma as never);
    const { user: demandeur } = await makePersonnel();
    const { user: techMaintenance } = await makeTechnicien(SousServiceIT.MAINTENANCE);
    await makeTechnicien(SousServiceIT.CYBER);

    await service.create({ nature: NatureRequete.PANNE_MATERIEL, description: 'Panne A' }, demandeur.id);
    await service.create({ nature: NatureRequete.INCIDENT_SECURITE, description: 'Incident B' }, demandeur.id);

    const result = await service.findAll({}, toAuthUser(techMaintenance.id, ['TECHNICIEN']));
    expect(result).toHaveLength(1);
    expect(result[0].sousServiceCible).toBe(SousServiceIT.MAINTENANCE);
  });

  it('findOne : demandeur voit sa requête, mais pas un tiers ENSEIGNANT non lié', async () => {
    const service = new RequeteService(prisma as never);
    const { user: demandeur } = await makePersonnel();
    const { user: tiers } = await makePersonnel();

    const created = await service.create(
      { nature: NatureRequete.AUTRE, description: 'Requête privée' },
      demandeur.id,
    );

    await expect(service.findOne(created.id, toAuthUser(demandeur.id, ['ENSEIGNANT']))).resolves.toMatchObject({
      id: created.id,
    });
    await expect(service.findOne(created.id, toAuthUser(tiers.id, ['ENSEIGNANT']))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('cloturer : introuvable → NotFoundException', async () => {
    const service = new RequeteService(prisma as never);
    const { user } = await makeTechnicien(SousServiceIT.CYBER);
    await expect(
      service.cloturer('00000000-0000-0000-0000-000000000000', toAuthUser(user.id, ['TECHNICIEN'])),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cloturer : technicien du bon sous-service → statut CLOTUREE + dateCloture renseignée', async () => {
    const service = new RequeteService(prisma as never);
    const { user: demandeur } = await makePersonnel();
    const { user: technicien } = await makeTechnicien(SousServiceIT.MAINTENANCE);

    const created = await service.create(
      { nature: NatureRequete.PANNE_MATERIEL, description: 'Panne réseau salle A' },
      demandeur.id,
    );

    const result = await service.cloturer(created.id, toAuthUser(technicien.id, ['TECHNICIEN']));
    expect(result.statut).toBe(StatutRequete.CLOTUREE);
    expect(result.dateCloture).not.toBeNull();
  });

  it('cloturer : déjà clôturée → ConflictException', async () => {
    const service = new RequeteService(prisma as never);
    const { user: demandeur } = await makePersonnel();
    const { user: technicien } = await makeTechnicien(SousServiceIT.MAINTENANCE);

    const created = await service.create(
      { nature: NatureRequete.PANNE_MATERIEL, description: 'Panne réseau salle A' },
      demandeur.id,
    );
    await service.cloturer(created.id, toAuthUser(technicien.id, ['TECHNICIEN']));

    await expect(
      service.cloturer(created.id, toAuthUser(technicien.id, ['TECHNICIEN'])),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
