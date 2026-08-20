import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaClient, StatutEmprunt, StatutOuvrage, StatutPaiement, StatutTransaction, TypeAbonne } from '@prisma/client';
import { createTestPrisma, truncateAll } from '../../../test/prisma-test-client';
import { RegularityService } from '../../scolarite/regularity/regularity.service';
import { EmpruntService } from './emprunt.service';

let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${seq++}`;

let prisma: PrismaClient;
let service: EmpruntService;

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
  service = new EmpruntService(prisma as never, new RegularityService(prisma as never));
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await truncateAll(prisma);
});

describe('Intégration — EmpruntService (isseg_test)', () => {
  it('étudiant régulier : emprunt créé, exemplairesDisponibles décrémenté', async () => {
    const section = await makeSection();
    const ouvrage = await makeOuvrage(section.id, 2);
    const { user, abonne } = await makeEtudiantAbonne();

    const result = await service.create({ ouvrageId: ouvrage.id, emprunteurId: user.id });

    expect(result.statut).toBe(StatutEmprunt.EN_COURS);
    expect(result.emprunteurId).toBe(user.id);

    const ouvrageApres = await prisma.ouvrage.findUniqueOrThrow({ where: { id: ouvrage.id } });
    expect(ouvrageApres.exemplairesDisponibles).toBe(1);
    expect(ouvrageApres.statut).toBe(StatutOuvrage.DISPONIBLE);

    void abonne;
  });

  it('dernier exemplaire : ouvrage passe EMPRUNTE', async () => {
    const section = await makeSection();
    const ouvrage = await makeOuvrage(section.id, 1);
    const { user } = await makeEtudiantAbonne();

    await service.create({ ouvrageId: ouvrage.id, emprunteurId: user.id });

    const ouvrageApres = await prisma.ouvrage.findUniqueOrThrow({ where: { id: ouvrage.id } });
    expect(ouvrageApres.exemplairesDisponibles).toBe(0);
    expect(ouvrageApres.statut).toBe(StatutOuvrage.EMPRUNTE);
  });

  it('étudiant non régulier (frais EN_ATTENTE) : emprunt refusé, aucune écriture', async () => {
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

  it('quota atteint (3 emprunts en cours pour un ETUDIANT_L1_L2) : refus', async () => {
    const section = await makeSection();
    const { user } = await makeEtudiantAbonne();

    for (let i = 0; i < 3; i++) {
      const o = await makeOuvrage(section.id, 1);
      await service.create({ ouvrageId: o.id, emprunteurId: user.id });
    }

    const ouvrageSupplementaire = await makeOuvrage(section.id, 1);
    await expect(
      service.create({ ouvrageId: ouvrageSupplementaire.id, emprunteurId: user.id }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('aucun exemplaire disponible : refus', async () => {
    const section = await makeSection();
    const ouvrage = await makeOuvrage(section.id, 1);
    const { user: user1 } = await makeEtudiantAbonne();
    const { user: user2 } = await makeEtudiantAbonne();

    await service.create({ ouvrageId: ouvrage.id, emprunteurId: user1.id });
    await expect(
      service.create({ ouvrageId: ouvrage.id, emprunteurId: user2.id }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('retour : exemplairesDisponibles réincrémenté, statut RETOURNE, retardJours calculé', async () => {
    const section = await makeSection();
    const ouvrage = await makeOuvrage(section.id, 1);
    const { user } = await makeEtudiantAbonne();

    const emprunt = await service.create({ ouvrageId: ouvrage.id, emprunteurId: user.id });

    // Retour anticipé (dateRetourPrevue dans 14 jours) → pas de retard
    const retour = await service.retour(emprunt.id);

    expect(retour.statut).toBe(StatutEmprunt.RETOURNE);
    expect(retour.retardJours).toBe(0);
    expect(retour.dateRetourEffectif).not.toBeNull();

    const ouvrageApres = await prisma.ouvrage.findUniqueOrThrow({ where: { id: ouvrage.id } });
    expect(ouvrageApres.exemplairesDisponibles).toBe(1);
    expect(ouvrageApres.statut).toBe(StatutOuvrage.DISPONIBLE);
  });

  it('retour en retard : dateRetourPrevue forcée dans le passé → retardJours > 0', async () => {
    const section = await makeSection();
    const ouvrage = await makeOuvrage(section.id, 1);
    const { user } = await makeEtudiantAbonne();

    const emprunt = await service.create({ ouvrageId: ouvrage.id, emprunteurId: user.id });
    await prisma.emprunt.update({
      where: { id: emprunt.id },
      data: { dateRetourPrevue: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
    });

    const retour = await service.retour(emprunt.id);
    expect(retour.retardJours).toBeGreaterThanOrEqual(5);
  });
});
