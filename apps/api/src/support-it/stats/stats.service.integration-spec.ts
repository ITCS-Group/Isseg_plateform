import { NatureRequete, PrismaClient, SousServiceIT, StatutRequete } from '@prisma/client';
import { createTestPrisma, truncateAll } from '../../../test/prisma-test-client';
import { RequeteService } from '../requetes/requete.service';
import { StatsService } from './stats.service';

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

beforeAll(() => {
  prisma = createTestPrisma();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await truncateAll(prisma);
});

describe('Intégration — StatsService.syntheseMensuelle (isseg_test)', () => {
  // Timeout étendu : ~12 allers-retours Neon séquentiels (2 fixtures + 3
  // créations de requête + 3 mises à jour de date + agrégats), au-delà du
  // défaut de 60s en cas de latence réseau élevée (cf. STATUT_MODULES.md
  // § Points techniques à surveiller, même symptôme déjà documenté sur
  // emprunt.service.integration-spec.ts).
  it('compte uniquement les requêtes du mois demandé, ventilées par sous-service/nature/statut', async () => {
    const requeteService = new RequeteService(prisma as never);
    const statsService = new StatsService(prisma as never);
    const { user: demandeur } = await makePersonnel();

    const requeteAoutMaintenance = await requeteService.create(
      { nature: NatureRequete.PANNE_MATERIEL, description: 'Panne écran' },
      demandeur.id,
    );
    const requeteAoutCyber = await requeteService.create(
      { nature: NatureRequete.INCIDENT_SECURITE, description: 'Phishing' },
      demandeur.id,
    );

    // Requête hors période (juillet) — ne doit pas apparaître dans la synthèse d'août.
    const requeteJuillet = await requeteService.create(
      { nature: NatureRequete.PANNE_MATERIEL, description: 'Ancienne panne' },
      demandeur.id,
    );
    await prisma.requete.update({
      where: { id: requeteJuillet.id },
      data: { dateOuverture: new Date(Date.UTC(2026, 6, 15)) },
    });
    await prisma.requete.update({
      where: { id: requeteAoutMaintenance.id },
      data: { dateOuverture: new Date(Date.UTC(2026, 7, 10)) },
    });
    await prisma.requete.update({
      where: { id: requeteAoutCyber.id },
      data: { dateOuverture: new Date(Date.UTC(2026, 7, 20)) },
    });

    const result = await statsService.syntheseMensuelle({ mois: '2026-08' });

    expect(result.mois).toBe('2026-08');

    const maintenance = result.parSousService.find((s) => s.sousService === SousServiceIT.MAINTENANCE);
    expect(maintenance?.totalRequetes).toBe(1);
    expect(maintenance?.parNature).toEqual([{ nature: NatureRequete.PANNE_MATERIEL, total: 1 }]);
    expect(maintenance?.parStatut).toEqual([{ statut: StatutRequete.OUVERTE, total: 1 }]);

    const cyber = result.parSousService.find((s) => s.sousService === SousServiceIT.CYBER);
    expect(cyber?.totalRequetes).toBe(1);

    const centreInfo = result.parSousService.find((s) => s.sousService === SousServiceIT.CENTRE_INFORMATIQUE);
    expect(centreInfo?.totalRequetes).toBe(0);
  }, 120_000);
});
