import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaClient, StatutAbandon } from '@prisma/client';
import { createTestPrisma, truncateAll } from '../../../test/prisma-test-client';
import { AbandonService } from './abandon.service';
import { DecisionReprise } from './dto/decider-reprise.dto';

// ── Utilitaires ──────────────────────────────────────────────────────────────
let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${seq++}`;

let prisma: PrismaClient;
let service: AbandonService;

interface FixtureOpts {
  inscriptionEstActive?: boolean;
  createInscription?: boolean;
}

async function makeFixtures(opts: FixtureOpts = {}) {
  const { inscriptionEstActive = true, createInscription = true } = opts;

  const agentSignale = await prisma.utilisateur.create({
    data: { nom: 'Agent', prenom: 'Signale', email: uid('signale') + '@t.local', motDePasseHash: 'x' },
  });
  const agentDecide = await prisma.utilisateur.create({
    data: { nom: 'Agent', prenom: 'Decide', email: uid('decide') + '@t.local', motDePasseHash: 'x' },
  });
  const studentUser = await prisma.utilisateur.create({
    data: { nom: 'Etu', prenom: 'Diant', email: uid('etu') + '@t.local', motDePasseHash: 'x' },
  });
  const filiere = await prisma.filiere.create({ data: { code: uid('F'), nom: 'Filiere test' } });
  const classe = await prisma.classe.create({
    data: { codeClasse: uid('C'), libelle: 'Classe test', niveau: 'L1', filiereId: filiere.id },
  });
  const annee = await prisma.anneeUniversitaire.create({
    data: {
      libelle: uid('AU'),
      dateDebut: new Date(Date.UTC(2026, 8, 1)),
      dateFin: new Date(Date.UTC(2027, 6, 1)),
    },
  });
  const etudiant = await prisma.etudiant.create({
    data: { userId: studentUser.id, dateNaissance: new Date(Date.UTC(2000, 0, 1)) },
  });

  const inscription = createInscription
    ? await prisma.inscription.create({
        data: { etudiantId: etudiant.id, classeId: classe.id, anneeId: annee.id, estActive: inscriptionEstActive },
      })
    : null;

  return { agentSignale, agentDecide, studentUser, filiere, classe, annee, etudiant, inscription };
}

const reloadInscription = (id: string) => prisma.inscription.findUniqueOrThrow({ where: { id } });
const reloadAbandon = (id: string) => prisma.abandon.findUniqueOrThrow({ where: { id } });

// ── Setup ────────────────────────────────────────────────────────────────────
beforeAll(() => {
  prisma = createTestPrisma(); // garde-fou : refuse si != isseg_test
  service = new AbandonService(prisma as never);
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await truncateAll(prisma);
});

// ════════════════════════════════════════════════════════════════════════════
describe('Intégration — AbandonService (isseg_test)', () => {
  // ── Signalement ────────────────────────────────────────────────────────────
  it('signaler() crée l\'Abandon en CONSTATE et désactive l\'inscription correspondante', async () => {
    const { etudiant, annee, agentSignale, inscription } = await makeFixtures({ inscriptionEstActive: true });

    const result = await service.signaler({ etudiantId: etudiant.id, anneeId: annee.id }, agentSignale.id);

    expect(result.statut).toBe(StatutAbandon.CONSTATE);
    expect(result.signaleParId).toBe(agentSignale.id);
    expect(result.dateConstat).toBeInstanceOf(Date);

    const reloaded = await reloadInscription(inscription!.id);
    expect(reloaded.estActive).toBe(false);
  });

  it('signaler() lève NotFoundException si aucune inscription ne correspond, sans créer l\'abandon', async () => {
    const { etudiant, annee, agentSignale } = await makeFixtures({ createInscription: false });

    await expect(
      service.signaler({ etudiantId: etudiant.id, anneeId: annee.id }, agentSignale.id),
    ).rejects.toBeInstanceOf(NotFoundException);

    const count = await prisma.abandon.count({ where: { etudiantId: etudiant.id, anneeId: annee.id } });
    expect(count).toBe(0);
  });

  it('signaler() lève ConflictException sur un second abandon (même étudiant, même année)', async () => {
    const { etudiant, annee, agentSignale } = await makeFixtures();
    await service.signaler({ etudiantId: etudiant.id, anneeId: annee.id }, agentSignale.id);

    await expect(
      service.signaler({ etudiantId: etudiant.id, anneeId: annee.id }, agentSignale.id),
    ).rejects.toBeInstanceOf(ConflictException);

    const count = await prisma.abandon.count({ where: { etudiantId: etudiant.id, anneeId: annee.id } });
    expect(count).toBe(1);
  });

  // ── Demande de reprise ───────────────────────────────────────────────────────
  it('demanderReprise() CONSTATE → REPRISE_DEMANDEE, inscription reste désactivée', async () => {
    const { etudiant, annee, agentSignale, inscription } = await makeFixtures();
    const abandon = await service.signaler({ etudiantId: etudiant.id, anneeId: annee.id }, agentSignale.id);

    const result = await service.demanderReprise(abandon.id);

    expect(result.statut).toBe(StatutAbandon.REPRISE_DEMANDEE);
    expect(result.dateDemandeReprise).toBeInstanceOf(Date);

    const reloaded = await reloadInscription(inscription!.id);
    expect(reloaded.estActive).toBe(false);
  });

  it('demanderReprise() lève UnprocessableEntityException depuis l\'état terminal REPRISE_ACCORDEE', async () => {
    const { etudiant, annee, agentSignale, agentDecide } = await makeFixtures();
    const abandon = await service.signaler({ etudiantId: etudiant.id, anneeId: annee.id }, agentSignale.id);
    await service.demanderReprise(abandon.id);
    await service.deciderReprise(abandon.id, agentDecide.id, { decision: DecisionReprise.ACCORDEE });

    await expect(service.demanderReprise(abandon.id)).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('demanderReprise() est autorisée après un refus (REPRISE_REFUSEE → REPRISE_DEMANDEE), un recours reste possible', async () => {
    const { etudiant, annee, agentSignale, agentDecide, inscription } = await makeFixtures();
    const abandon = await service.signaler({ etudiantId: etudiant.id, anneeId: annee.id }, agentSignale.id);
    await service.demanderReprise(abandon.id);
    await service.deciderReprise(abandon.id, agentDecide.id, { decision: DecisionReprise.REFUSEE });

    const reopened = await service.demanderReprise(abandon.id);
    expect(reopened.statut).toBe(StatutAbandon.REPRISE_DEMANDEE);

    const accorded = await service.deciderReprise(abandon.id, agentDecide.id, {
      decision: DecisionReprise.ACCORDEE,
    });
    expect(accorded.statut).toBe(StatutAbandon.REPRISE_ACCORDEE);

    const reloaded = await reloadInscription(inscription!.id);
    expect(reloaded.estActive).toBe(true);
  });

  // ── Décision de reprise ──────────────────────────────────────────────────────
  it('deciderReprise() ACCORDEE réactive l\'inscription correspondante', async () => {
    const { etudiant, annee, agentSignale, agentDecide, inscription } = await makeFixtures();
    const abandon = await service.signaler({ etudiantId: etudiant.id, anneeId: annee.id }, agentSignale.id);
    await service.demanderReprise(abandon.id);

    const result = await service.deciderReprise(abandon.id, agentDecide.id, {
      decision: DecisionReprise.ACCORDEE,
    });

    expect(result.statut).toBe(StatutAbandon.REPRISE_ACCORDEE);
    expect(result.decideParId).toBe(agentDecide.id);
    expect(result.dateDecisionReprise).toBeInstanceOf(Date);

    const reloaded = await reloadInscription(inscription!.id);
    expect(reloaded.estActive).toBe(true);
  });

  it('deciderReprise() REFUSEE laisse l\'inscription désactivée', async () => {
    const { etudiant, annee, agentSignale, agentDecide, inscription } = await makeFixtures();
    const abandon = await service.signaler({ etudiantId: etudiant.id, anneeId: annee.id }, agentSignale.id);
    await service.demanderReprise(abandon.id);

    const result = await service.deciderReprise(abandon.id, agentDecide.id, {
      decision: DecisionReprise.REFUSEE,
    });

    expect(result.statut).toBe(StatutAbandon.REPRISE_REFUSEE);
    const reloaded = await reloadInscription(inscription!.id);
    expect(reloaded.estActive).toBe(false);
  });

  it('deciderReprise() lève UnprocessableEntityException si aucune reprise n\'a été demandée', async () => {
    const { etudiant, annee, agentSignale, agentDecide } = await makeFixtures();
    const abandon = await service.signaler({ etudiantId: etudiant.id, anneeId: annee.id }, agentSignale.id);

    await expect(
      service.deciderReprise(abandon.id, agentDecide.id, { decision: DecisionReprise.ACCORDEE }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    const reloaded = await reloadAbandon(abandon.id);
    expect(reloaded.statut).toBe(StatutAbandon.CONSTATE);
  });

  // ── Lecture ──────────────────────────────────────────────────────────────────
  it('findOne() lève NotFoundException pour un id inexistant', async () => {
    await expect(service.findOne('00000000-0000-0000-0000-000000000000')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('findAll() filtre par statut et pagine', async () => {
    const a = await makeFixtures();
    await service.signaler({ etudiantId: a.etudiant.id, anneeId: a.annee.id }, a.agentSignale.id);
    const b = await makeFixtures();
    const bAbandon = await service.signaler({ etudiantId: b.etudiant.id, anneeId: b.annee.id }, b.agentSignale.id);
    await service.demanderReprise(bAbandon.id);

    const constates = await service.findAll({ page: 1, limit: 20, statut: StatutAbandon.CONSTATE });
    expect(constates.data).toHaveLength(1);
    expect(constates.meta.total).toBe(1);

    const all = await service.findAll({ page: 1, limit: 20 });
    expect(all.meta.total).toBe(2);
  });
});
