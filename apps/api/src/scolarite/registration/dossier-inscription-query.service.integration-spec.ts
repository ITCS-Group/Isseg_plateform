import { PrismaClient, StatutDossier } from '@prisma/client';
import { createTestPrisma, truncateAll } from '../../../test/prisma-test-client';
import { DossierInscriptionQueryService } from './dossier-inscription-query.service';

// ── Utilitaires ──────────────────────────────────────────────────────────────
let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${seq++}`;

let prisma: PrismaClient;
let service: DossierInscriptionQueryService;

async function makeAnnee(estActive: boolean, dateDebut = new Date(Date.UTC(2026, 8, 1))) {
  return prisma.anneeUniversitaire.create({
    data: {
      libelle: uid('AU'),
      dateDebut,
      dateFin: new Date(dateDebut.getTime() + 300 * 24 * 3600 * 1000),
      estActive,
    },
  });
}

async function makeFiliereClasse(nom = 'Filiere test') {
  const filiere = await prisma.filiere.create({ data: { code: uid('F'), nom } });
  const classe = await prisma.classe.create({
    data: { codeClasse: uid('C'), libelle: 'L1-A', niveau: 'L1', filiereId: filiere.id },
  });
  return { filiere, classe };
}

interface DossierOpts {
  anneeId: string;
  classeId: string;
  statut: StatutDossier;
  nom?: string;
  prenom?: string;
  matriculeUnique?: string | null;
  dateSoumission?: Date | null;
}

async function makeDossier(opts: DossierOpts) {
  const user = await prisma.utilisateur.create({
    data: {
      nom: opts.nom ?? 'Etu',
      prenom: opts.prenom ?? 'Diant',
      email: uid('etu') + '@t.local',
      motDePasseHash: 'x',
    },
  });
  const etudiant = await prisma.etudiant.create({
    data: {
      userId: user.id,
      dateNaissance: new Date(Date.UTC(2000, 0, 1)),
      matriculeUnique: opts.matriculeUnique ?? null,
    },
  });
  const dossier = await prisma.dossierInscription.create({
    data: {
      etudiantId: etudiant.id,
      anneeId: opts.anneeId,
      classeId: opts.classeId,
      documentsFournis: [],
      statutDossier: opts.statut,
      dateSoumission: opts.dateSoumission ?? null,
    },
  });
  return { user, etudiant, dossier };
}

// ── Setup ────────────────────────────────────────────────────────────────────
beforeAll(() => {
  prisma = createTestPrisma(); // garde-fou : refuse si != isseg_test
  service = new DossierInscriptionQueryService(prisma as never);
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await truncateAll(prisma);
});

// ════════════════════════════════════════════════════════════════════════════
describe('Intégration — DossierInscriptionQueryService (isseg_test)', () => {
  describe('stats()', () => {
    it('effectifInscrit ne compte que les dossiers INSCRIT de l’année active', async () => {
      const active = await makeAnnee(true);
      const inactive = await makeAnnee(false, new Date(Date.UTC(2025, 8, 1)));
      const { classe: classeActive } = await makeFiliereClasse();
      const { classe: classeInactive } = await makeFiliereClasse();

      await makeDossier({ anneeId: active.id, classeId: classeActive.id, statut: StatutDossier.INSCRIT });
      await makeDossier({ anneeId: active.id, classeId: classeActive.id, statut: StatutDossier.INSCRIT });
      await makeDossier({ anneeId: active.id, classeId: classeActive.id, statut: StatutDossier.SOUMIS });
      await makeDossier({ anneeId: active.id, classeId: classeActive.id, statut: StatutDossier.BROUILLON });
      await makeDossier({ anneeId: active.id, classeId: classeActive.id, statut: StatutDossier.REJETE });
      // Bruit : INSCRIT mais sur l'année INACTIVE → ne doit pas être compté.
      await makeDossier({ anneeId: inactive.id, classeId: classeInactive.id, statut: StatutDossier.INSCRIT });

      const result = await service.stats();

      expect(result).toEqual({ effectifInscrit: 2 });
    });

    it("renvoie 0 si aucune année n'est marquée active", async () => {
      await makeAnnee(false);

      const result = await service.stats();

      expect(result).toEqual({ effectifInscrit: 0 });
    });
  });

  describe('findAll()', () => {
    it("ne liste que les dossiers de l'année active, tous statuts confondus", async () => {
      const active = await makeAnnee(true);
      const inactive = await makeAnnee(false, new Date(Date.UTC(2025, 8, 1)));
      const { classe: classeActive } = await makeFiliereClasse();
      const { classe: classeInactive } = await makeFiliereClasse();

      await makeDossier({ anneeId: active.id, classeId: classeActive.id, statut: StatutDossier.INSCRIT });
      await makeDossier({ anneeId: active.id, classeId: classeActive.id, statut: StatutDossier.BROUILLON });
      await makeDossier({ anneeId: inactive.id, classeId: classeInactive.id, statut: StatutDossier.INSCRIT });

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.meta.total).toBe(2);
      expect(result.data).toHaveLength(2);
    });

    it('mappe exactement les champs (matricule, nom, prénom, filière, classe, statut, dateSoumission)', async () => {
      const active = await makeAnnee(true);
      const { filiere, classe } = await makeFiliereClasse("Sciences de l'Éducation");
      const dateSoumission = new Date(Date.UTC(2026, 8, 15));

      const { dossier } = await makeDossier({
        anneeId: active.id,
        classeId: classe.id,
        statut: StatutDossier.INSCRIT,
        nom: 'Diallo',
        prenom: 'Fatoumata',
        matriculeUnique: 'ISSEG-2026-0042',
        dateSoumission,
      });

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      const row = result.data[0];
      expect(row.id).toBe(dossier.id);
      expect(row.matricule).toBe('ISSEG-2026-0042');
      expect(row.etudiantNom).toBe('Diallo');
      expect(row.etudiantPrenom).toBe('Fatoumata');
      expect(row.filiere).toBe(filiere.nom);
      expect(row.classeLibelle).toBe(classe.libelle);
      expect(row.statutDossier).toBe(StatutDossier.INSCRIT);
      expect(row.dateSoumission?.toISOString()).toBe(dateSoumission.toISOString());
    });

    it('matricule et dateSoumission null (dossier BROUILLON) → propagés tels quels', async () => {
      const active = await makeAnnee(true);
      const { classe } = await makeFiliereClasse();

      await makeDossier({
        anneeId: active.id,
        classeId: classe.id,
        statut: StatutDossier.BROUILLON,
        matriculeUnique: null,
        dateSoumission: null,
      });

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data[0].matricule).toBeNull();
      expect(result.data[0].dateSoumission).toBeNull();
    });

    it('pagination correcte sur 5 dossiers avec limit=2 (meta.totalPages, dernière page partielle)', async () => {
      const active = await makeAnnee(true);
      const { classe } = await makeFiliereClasse();

      for (let i = 0; i < 5; i++) {
        await makeDossier({ anneeId: active.id, classeId: classe.id, statut: StatutDossier.SOUMIS });
      }

      const page1 = await service.findAll({ page: 1, limit: 2 });
      expect(page1.meta).toEqual({ total: 5, page: 1, limit: 2, totalPages: 3 });
      expect(page1.data).toHaveLength(2);

      const page2 = await service.findAll({ page: 2, limit: 2 });
      expect(page2.data).toHaveLength(2);

      const page3 = await service.findAll({ page: 3, limit: 2 });
      expect(page3.data).toHaveLength(1);

      // Pas de chevauchement entre pages.
      const ids = [...page1.data, ...page2.data, ...page3.data].map((d) => d.id);
      expect(new Set(ids).size).toBe(5);
    });

    it('trié par createdAt décroissant (le plus récemment créé en premier)', async () => {
      const active = await makeAnnee(true);
      const { classe } = await makeFiliereClasse();

      const { dossier: first } = await makeDossier({
        anneeId: active.id,
        classeId: classe.id,
        statut: StatutDossier.SOUMIS,
        nom: 'Premier',
      });
      await new Promise((r) => setTimeout(r, 20));
      const { dossier: second } = await makeDossier({
        anneeId: active.id,
        classeId: classe.id,
        statut: StatutDossier.SOUMIS,
        nom: 'Second',
      });

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data[0].id).toBe(second.id);
      expect(result.data[1].id).toBe(first.id);
    });

    it("renvoie une page vide si aucune année n'est active", async () => {
      await makeAnnee(false);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result).toEqual({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } });
    });
  });
});
