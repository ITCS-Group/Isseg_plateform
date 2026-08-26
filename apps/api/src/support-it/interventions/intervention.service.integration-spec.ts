import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { NatureRequete, PrismaClient, SousServiceIT, StatutRequete } from '@prisma/client';
import { createTestPrisma, truncateAll } from '../../../test/prisma-test-client';
import type { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import { RequeteService } from '../requetes/requete.service';
import { InterventionService } from './intervention.service';

let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${seq++}`;

let prisma: PrismaClient;

async function makePersonnel() {
  const user = await prisma.utilisateur.create({
    data: { nom: 'Diallo', prenom: 'Ibrahim', email: uid('pers') + '@t.local', motDePasseHash: 'x' },
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

describe('Intégration — InterventionService (isseg_test)', () => {
  it('création : technicien du bon sous-service → intervention créée, requête OUVERTE passe EN_COURS', async () => {
    const requeteService = new RequeteService(prisma as never);
    const interventionService = new InterventionService(prisma as never);
    const { user: demandeur } = await makePersonnel();
    const { user: technicien } = await makeTechnicien(SousServiceIT.MAINTENANCE);

    const requete = await requeteService.create(
      { nature: NatureRequete.PANNE_MATERIEL, description: 'Écran cassé salle B12' },
      demandeur.id,
    );
    expect(requete.statut).toBe(StatutRequete.OUVERTE);

    const intervention = await interventionService.create(
      requete.id,
      { compteRendu: 'Écran remplacé, testé OK' },
      technicien.id,
    );
    expect(intervention.requeteId).toBe(requete.id);

    const requeteApres = await prisma.requete.findUniqueOrThrow({ where: { id: requete.id } });
    expect(requeteApres.statut).toBe(StatutRequete.EN_COURS);
  });

  it('création : technicien d’un autre sous-service → ForbiddenException, rien en base', async () => {
    const requeteService = new RequeteService(prisma as never);
    const interventionService = new InterventionService(prisma as never);
    const { user: demandeur } = await makePersonnel();
    const { user: technicienCyber } = await makeTechnicien(SousServiceIT.CYBER);

    const requete = await requeteService.create(
      { nature: NatureRequete.PANNE_MATERIEL, description: 'Panne matériel salle C' },
      demandeur.id,
    );

    await expect(
      interventionService.create(requete.id, { compteRendu: 'Tentative hors périmètre' }, technicienCyber.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(await prisma.intervention.count()).toBe(0);
  });

  it('création : requête clôturée → ConflictException', async () => {
    const requeteService = new RequeteService(prisma as never);
    const interventionService = new InterventionService(prisma as never);
    const { user: demandeur } = await makePersonnel();

    const requete = await requeteService.create(
      { nature: NatureRequete.RESEAU, description: 'Coupure réseau bâtiment A' },
      demandeur.id,
    );
    const { user: technicienMaintenance } = await makeTechnicien(SousServiceIT.MAINTENANCE);
    await requeteService.cloturer(requete.id, toAuthUser(technicienMaintenance.id, ['TECHNICIEN']));

    await expect(
      interventionService.create(requete.id, { compteRendu: 'Trop tard' }, technicienMaintenance.id),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('findAllForRequete : le demandeur voit les interventions de sa requête, un tiers non', async () => {
    const requeteService = new RequeteService(prisma as never);
    const interventionService = new InterventionService(prisma as never);
    const { user: demandeur } = await makePersonnel();
    const { user: tiers } = await makePersonnel();
    const { user: technicien } = await makeTechnicien(SousServiceIT.CENTRE_INFORMATIQUE);

    const requete = await requeteService.create(
      { nature: NatureRequete.ACCES_COMPTE, description: 'Compte bloqué' },
      demandeur.id,
    );
    await interventionService.create(requete.id, { compteRendu: 'Compte débloqué' }, technicien.id);

    const vuParDemandeur = await interventionService.findAllForRequete(
      requete.id,
      { page: 1, limit: 20 },
      toAuthUser(demandeur.id, ['ENSEIGNANT']),
    );
    expect(vuParDemandeur.data).toHaveLength(1);

    await expect(
      interventionService.findAllForRequete(requete.id, { page: 1, limit: 20 }, toAuthUser(tiers.id, ['ENSEIGNANT'])),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('findAllForRequete : requête introuvable → NotFoundException', async () => {
    const interventionService = new InterventionService(prisma as never);
    const { user } = await makePersonnel();
    await expect(
      interventionService.findAllForRequete(
        '00000000-0000-0000-0000-000000000000',
        { page: 1, limit: 20 },
        toAuthUser(user.id, ['ENSEIGNANT']),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
