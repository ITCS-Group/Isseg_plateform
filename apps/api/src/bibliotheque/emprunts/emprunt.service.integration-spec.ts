import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, StatutEmprunt, StatutOuvrage, StatutPaiement, StatutTransaction, TypeAbonne } from '@prisma/client';
import { createTestPrisma, truncateAll } from '../../../test/prisma-test-client';
import { RegularityService } from '../../scolarite/regularity/regularity.service';
import { EmpruntService } from './emprunt.service';

let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${seq++}`;

let prisma: PrismaClient;

/** Service avec la config par défaut : seul ENSEIGNANT emprunte à domicile. */
function makeService(typesAutorises: string[] = ['ENSEIGNANT']) {
  const config = new ConfigService({ bibliotheque: { empruntDomicileTypesAutorises: typesAutorises } });
  return new EmpruntService(prisma as never, new RegularityService(prisma as never), config);
}

interface FraisOpts {
  statutPaiement?: StatutPaiement;
}

async function makeSection() {
  return prisma.sectionBibliotheque.create({ data: { code: uid('SEC'), nom: 'Section test' } });
}

async function makeOuvrage(sectionId: string, exemplaires = 2) {
  return prisma.ouvrage.create({
    data: {
      titre: 'Ouvrage test',
      auteur: 'Auteur',
      editeur: 'Editeur',
      anneeEdition: 2020,
      cote: uid('COTE'),
      matieres: ['Éducation'],
      salle: 'S1',
      etagere: 'E1',
      nombreExemplaires: exemplaires,
      exemplairesDisponibles: exemplaires,
      sectionId,
    },
  });
}

/** Abonné ENSEIGNANT — type autorisé par défaut, pas besoin de fiche Etudiant. */
async function makeEnseignantAbonne() {
  const user = await prisma.utilisateur.create({
    data: { nom: 'Ens', prenom: 'Seignant', email: uid('ens') + '@t.local', motDePasseHash: 'x' },
  });
  const abonne = await prisma.abonne.create({
    data: { utilisateurId: user.id, typeAbonne: TypeAbonne.ENSEIGNANT, limiteEmprunts: 10, dureePretJours: 30 },
  });
  return { user, abonne };
}

/** Étudiant régulier par défaut (FraisScolarite PAYE + transaction COMPLETEE) + Abonne actif. */
async function makeEtudiantAbonne(fraisOpts: FraisOpts = {}) {
  const { statutPaiement = StatutPaiement.PAYE } = fraisOpts;

  const user = await prisma.utilisateur.create({
    data: { nom: 'Etu', prenom: 'Diant', email: uid('etu') + '@t.local', motDePasseHash: 'x' },
  });
  const etudiant = await prisma.etudiant.create({
    data: { userId: user.id, dateNaissance: new Date(Date.UTC(2000, 0, 1)), matriculeUnique: uid('ISSEG') },
  });
  const filiere = await prisma.filiere.create({ data: { code: uid('F'), nom: 'Filiere test' } });
  const classe = await prisma.classe.create({
    data: { codeClasse: uid('C'), libelle: 'Classe test', niveau: 'L1', filiereId: filiere.id },
  });
  const annee = await prisma.anneeUniversitaire.create({
    data: { libelle: uid('AU'), dateDebut: new Date(Date.UTC(2026, 8, 1)), dateFin: new Date(Date.UTC(2027, 5, 1)) },
  });
  const inscription = await prisma.inscription.create({
    data: { etudiantId: etudiant.id, classeId: classe.id, anneeId: annee.id, estActive: true },
  });

  const agentUser = await prisma.utilisateur.create({
    data: { nom: 'Agent', prenom: 'Compta', email: uid('agent') + '@t.local', motDePasseHash: 'x' },
  });
  const agent = await prisma.personnel.create({
    data: { userId: agentUser.id, matricule: uid('PERS'), poste: 'Comptable', dateEmbauche: new Date(Date.UTC(2020, 0, 1)), salaire: 0 },
  });
  await prisma.fraisScolarite.create({
    data: {
      inscriptionId: inscription.id,
      enregistreParId: agent.id,
      anneeId: annee.id,
      montantTotal: 1_000_000,
      montantPaye: statutPaiement === StatutPaiement.PAYE ? 1_000_000 : 0,
      statutPaiement,
    },
  });

  const abonne = await prisma.abonne.create({
    data: {
      utilisateurId: user.id,
      typeAbonne: TypeAbonne.ETUDIANT_L1_L2,
      limiteEmprunts: 3,
      dureePretJours: 14,
    },
  });

  return { user, etudiant, abonne };
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

describe('Intégration — EmpruntService (isseg_test)', () => {
  // ── Restriction prêt à domicile (décision métier 05/08/2026) ────────────────
  describe('restriction prêt à domicile (config BIBLIOTHEQUE_EMPRUNT_DOMICILE_TYPES_AUTORISES)', () => {
    it('étudiant régulier, config par défaut (ENSEIGNANT seul) : emprunt refusé', async () => {
      const service = makeService();
      const section = await makeSection();
      const ouvrage = await makeOuvrage(section.id, 2);
      const { user } = await makeEtudiantAbonne();

      await expect(
        service.create({ ouvrageId: ouvrage.id, emprunteurId: user.id }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      const ouvrageApres = await prisma.ouvrage.findUniqueOrThrow({ where: { id: ouvrage.id } });
      expect(ouvrageApres.exemplairesDisponibles).toBe(2);
      expect(await prisma.emprunt.count()).toBe(0);
    });

    it('ENSEIGNANT, config par défaut : emprunt créé', async () => {
      const service = makeService();
      const section = await makeSection();
      const ouvrage = await makeOuvrage(section.id, 2);
      const { user } = await makeEnseignantAbonne();

      const result = await service.create({ ouvrageId: ouvrage.id, emprunteurId: user.id });
      expect(result.statut).toBe(StatutEmprunt.EN_COURS);
    });

    it('étudiant régulier, config étendue à ETUDIANT_L1_L2 : emprunt créé sans changement de code', async () => {
      const service = makeService(['ENSEIGNANT', 'ETUDIANT_L1_L2']);
      const section = await makeSection();
      const ouvrage = await makeOuvrage(section.id, 2);
      const { user } = await makeEtudiantAbonne();

      const result = await service.create({ ouvrageId: ouvrage.id, emprunteurId: user.id });
      expect(result.statut).toBe(StatutEmprunt.EN_COURS);
    });
  });

  it('ENSEIGNANT : emprunt créé, exemplairesDisponibles décrémenté', async () => {
    const service = makeService();
    const section = await makeSection();
    const ouvrage = await makeOuvrage(section.id, 2);
    const { user, abonne } = await makeEnseignantAbonne();

    const result = await service.create({ ouvrageId: ouvrage.id, emprunteurId: user.id });

    expect(result.statut).toBe(StatutEmprunt.EN_COURS);
    expect(result.emprunteurId).toBe(user.id);

    const ouvrageApres = await prisma.ouvrage.findUniqueOrThrow({ where: { id: ouvrage.id } });
    expect(ouvrageApres.exemplairesDisponibles).toBe(1);
    expect(ouvrageApres.statut).toBe(StatutOuvrage.DISPONIBLE);

    void abonne;
  });

  it('dernier exemplaire : ouvrage passe EMPRUNTE', async () => {
    const service = makeService();
    const section = await makeSection();
    const ouvrage = await makeOuvrage(section.id, 1);
    const { user } = await makeEnseignantAbonne();

    await service.create({ ouvrageId: ouvrage.id, emprunteurId: user.id });

    const ouvrageApres = await prisma.ouvrage.findUniqueOrThrow({ where: { id: ouvrage.id } });
    expect(ouvrageApres.exemplairesDisponibles).toBe(0);
    expect(ouvrageApres.statut).toBe(StatutOuvrage.EMPRUNTE);
  });

  it('étudiant non régulier (frais EN_ATTENTE), config étendue : emprunt refusé pour cause de régularité, pas de type', async () => {
    const service = makeService(['ENSEIGNANT', 'ETUDIANT_L1_L2']);
    const section = await makeSection();
    const ouvrage = await makeOuvrage(section.id, 2);
    const { user } = await makeEtudiantAbonne({ statutPaiement: StatutPaiement.EN_ATTENTE });

    await expect(
      service.create({ ouvrageId: ouvrage.id, emprunteurId: user.id }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const ouvrageApres = await prisma.ouvrage.findUniqueOrThrow({ where: { id: ouvrage.id } });
    expect(ouvrageApres.exemplairesDisponibles).toBe(2);
    const empruntsCount = await prisma.emprunt.count();
    expect(empruntsCount).toBe(0);
  });

  it('quota atteint (10 emprunts en cours pour un ENSEIGNANT) : refus', async () => {
    const service = makeService();
    const section = await makeSection();
    const { user } = await makeEnseignantAbonne();

    for (let i = 0; i < 10; i++) {
      const o = await makeOuvrage(section.id, 1);
      await service.create({ ouvrageId: o.id, emprunteurId: user.id });
    }

    const ouvrageSupplementaire = await makeOuvrage(section.id, 1);
    await expect(
      service.create({ ouvrageId: ouvrageSupplementaire.id, emprunteurId: user.id }),
    ).rejects.toBeInstanceOf(ConflictException);
  }, 30_000);

  it('aucun exemplaire disponible : refus', async () => {
    const service = makeService();
    const section = await makeSection();
    const ouvrage = await makeOuvrage(section.id, 1);
    const { user: user1 } = await makeEnseignantAbonne();
    const { user: user2 } = await makeEnseignantAbonne();

    await service.create({ ouvrageId: ouvrage.id, emprunteurId: user1.id });
    await expect(
      service.create({ ouvrageId: ouvrage.id, emprunteurId: user2.id }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('retour : exemplairesDisponibles réincrémenté, statut RETOURNE, retardJours calculé', async () => {
    const service = makeService();
    const section = await makeSection();
    const ouvrage = await makeOuvrage(section.id, 1);
    const { user } = await makeEnseignantAbonne();

    const emprunt = await service.create({ ouvrageId: ouvrage.id, emprunteurId: user.id });

    // Retour anticipé (dateRetourPrevue dans 30 jours) → pas de retard
    const retour = await service.retour(emprunt.id);

    expect(retour.statut).toBe(StatutEmprunt.RETOURNE);
    expect(retour.retardJours).toBe(0);
    expect(retour.dateRetourEffectif).not.toBeNull();

    const ouvrageApres = await prisma.ouvrage.findUniqueOrThrow({ where: { id: ouvrage.id } });
    expect(ouvrageApres.exemplairesDisponibles).toBe(1);
    expect(ouvrageApres.statut).toBe(StatutOuvrage.DISPONIBLE);
  });

  it('retour en retard : dateRetourPrevue forcée dans le passé → retardJours > 0', async () => {
    const service = makeService();
    const section = await makeSection();
    const ouvrage = await makeOuvrage(section.id, 1);
    const { user } = await makeEnseignantAbonne();

    const emprunt = await service.create({ ouvrageId: ouvrage.id, emprunteurId: user.id });
    await prisma.emprunt.update({
      where: { id: emprunt.id },
      data: { dateRetourPrevue: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
    });

    const retour = await service.retour(emprunt.id);
    expect(retour.retardJours).toBeGreaterThanOrEqual(5);
  });

  // ── findAll — pagination (BACK-02-A) ────────────────────────────────────────
  describe('findAll — pagination', () => {
    const BIB = { id: 'bib-1', roles: ['BIBLIOTHECAIRE'] };

    /** Crée `n` emprunts pour un même enseignant (quota 10, donc n <= 10). */
    async function seedEmprunts(n: number) {
      const service = makeService();
      const section = await makeSection();
      const { user } = await makeEnseignantAbonne();
      for (let i = 0; i < n; i += 1) {
        const ouvrage = await makeOuvrage(section.id, 1);
        await service.create({ ouvrageId: ouvrage.id, emprunteurId: user.id });
      }
      return { service, user };
    }

    it('page par défaut : meta cohérent avec le nombre réel d’emprunts', async () => {
      const { service } = await seedEmprunts(3);

      const result = await service.findAll({ page: 1, limit: 20 }, BIB);

      expect(result.data).toHaveLength(3);
      expect(result.meta).toEqual({ total: 3, page: 1, limit: 20, totalPages: 1 });
    });

    it('dernière page partielle : reste des éléments, sans doublon entre les pages', async () => {
      const { service } = await seedEmprunts(5);

      const page1 = await service.findAll({ page: 1, limit: 2 }, BIB);
      const page3 = await service.findAll({ page: 3, limit: 2 }, BIB);

      expect(page1.data).toHaveLength(2);
      expect(page3.data).toHaveLength(1); // 5 = 2 + 2 + 1
      expect(page3.meta).toEqual({ total: 5, page: 3, limit: 2, totalPages: 3 });
      expect(page1.data.map((e) => e.id)).not.toContain(page3.data[0].id);
    });

    it('page au-delà du dernier index : data vide, meta.total inchangé', async () => {
      const { service } = await seedEmprunts(2);

      const result = await service.findAll({ page: 9, limit: 20 }, BIB);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(2);
    });

    it('pagination + filtre statut : meta.total ne compte que les lignes filtrées', async () => {
      const { service } = await seedEmprunts(3);
      const tous = await service.findAll({ page: 1, limit: 20 }, BIB);
      await service.retour(tous.data[0].id); // 1 RETOURNE, 2 EN_COURS

      const enCours = await service.findAll(
        { page: 1, limit: 20, statut: StatutEmprunt.EN_COURS },
        BIB,
      );

      expect(enCours.meta.total).toBe(2);
      expect(enCours.data).toHaveLength(2);
    });

    it('scoping ETUDIANT préservé : meta.total ne compte que ses propres emprunts', async () => {
      const service = makeService(['ENSEIGNANT', 'ETUDIANT_L1_L2']);
      const section = await makeSection();

      const { user: ens } = await makeEnseignantAbonne();
      const ouvrageEns = await makeOuvrage(section.id, 1);
      await service.create({ ouvrageId: ouvrageEns.id, emprunteurId: ens.id });

      const { user: etu } = await makeEtudiantAbonne();
      const ouvrageEtu = await makeOuvrage(section.id, 1);
      await service.create({ ouvrageId: ouvrageEtu.id, emprunteurId: etu.id });

      // L'étudiant demande « tous » les emprunts : scoping forcé sur les siens.
      const vueEtudiant = await service.findAll(
        { page: 1, limit: 20, emprunteurId: ens.id },
        { id: etu.id, roles: ['ETUDIANT'] },
      );

      expect(vueEtudiant.meta.total).toBe(1);
      expect(vueEtudiant.data).toHaveLength(1);
      expect(vueEtudiant.data[0].emprunteurId).toBe(etu.id);

      // Le bibliothécaire voit bien les deux.
      const vueBib = await service.findAll({ page: 1, limit: 20 }, BIB);
      expect(vueBib.meta.total).toBe(2);
    });
  });
});
