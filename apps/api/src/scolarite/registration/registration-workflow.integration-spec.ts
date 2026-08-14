import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaClient, StatutDossier } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  createTestPrisma,
  readMatriculeSeq,
  resetMatriculeSequence,
  truncateAll,
} from '../../../test/prisma-test-client';
import { RejectDossierDto } from './dto/reject-dossier.dto';
import { RegistrationWorkflowService } from './registration-workflow.service';

// ── Utilitaires ──────────────────────────────────────────────────────────────
let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${seq++}`;

let prisma: PrismaClient;
let service: RegistrationWorkflowService;

interface FixtureOpts {
  statut?: StatutDossier;
  version?: number;
  matriculeUnique?: string | null;
  anneeDateDebut?: Date;
}

async function makeFixtures(opts: FixtureOpts = {}) {
  const {
    statut = StatutDossier.BROUILLON,
    matriculeUnique = null,
    anneeDateDebut = new Date(Date.UTC(2026, 8, 1)),
  } = opts;

  const actor = await prisma.utilisateur.create({
    data: { nom: 'Agent', prenom: 'Scol', email: uid('agent') + '@t.local', motDePasseHash: 'x' },
  });
  const studentUser = await prisma.utilisateur.create({
    data: { nom: 'Etu', prenom: 'Diant', email: uid('etu') + '@t.local', motDePasseHash: 'x' },
  });
  const filiere = await prisma.filiere.create({
    data: { code: uid('F'), nom: 'Filiere test' },
  });
  const classe = await prisma.classe.create({
    data: { codeClasse: uid('C'), libelle: 'Classe test', niveau: 'L1', filiereId: filiere.id },
  });
  const annee = await prisma.anneeUniversitaire.create({
    data: {
      libelle: uid('AU'),
      dateDebut: anneeDateDebut,
      dateFin: new Date(anneeDateDebut.getTime() + 300 * 24 * 3600 * 1000),
    },
  });
  const etudiant = await prisma.etudiant.create({
    data: { userId: studentUser.id, dateNaissance: new Date(Date.UTC(2000, 0, 1)), matriculeUnique },
  });
  const dossier = await prisma.dossierInscription.create({
    data: {
      etudiantId: etudiant.id,
      anneeId: annee.id,
      classeId: classe.id,
      documentsFournis: [],
      statutDossier: statut,
    },
  });
  return { actor, studentUser, filiere, classe, annee, etudiant, dossier };
}

const history = (dossierId: string) =>
  prisma.registrationHistory.findMany({ where: { dossierId }, orderBy: { changedAt: 'asc' } });
const outbox = (dossierId: string) =>
  prisma.outboxEvent.findMany({ where: { aggregateId: dossierId }, orderBy: { createdAt: 'asc' } });
const reload = (id: string) => prisma.dossierInscription.findUniqueOrThrow({ where: { id } });

// Reproduit la ValidationPipe : lève 400 si le DTO est invalide.
async function validatedRejectDto(raw: unknown): Promise<RejectDossierDto> {
  const dto = plainToInstance(RejectDossierDto, raw);
  const errors = await validate(dto as object);
  if (errors.length > 0) throw new BadRequestException('DTO invalide');
  return dto;
}

// ── Setup ────────────────────────────────────────────────────────────────────
beforeAll(() => {
  prisma = createTestPrisma(); // garde-fou : refuse si != isseg_test
  service = new RegistrationWorkflowService(prisma as never);
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await truncateAll(prisma);
  await resetMatriculeSequence(prisma);
});

// ════════════════════════════════════════════════════════════════════════════
describe('Intégration — RegistrationWorkflowService (isseg_test)', () => {
  // ── 1 & 2. Happy paths + champs spécifiques ──────────────────────────────────
  it('T1 BROUILLON → SOUMIS : statut, version+1, dateSoumission, history+outbox', async () => {
    const { dossier, actor } = await makeFixtures({ statut: StatutDossier.BROUILLON });

    const res = await service.submit(dossier.id, actor.id, { expectedVersion: 1, comment: 'go' });

    const d = await reload(dossier.id);
    expect(d.statutDossier).toBe(StatutDossier.SOUMIS);
    expect(d.version).toBe(2);
    expect(d.dateSoumission).not.toBeNull();
    expect(d.dateValidation).toBeNull();
    expect(d.validePar).toBeNull();
    expect(d.motifRejet).toBeNull();
    expect(d.decisionScolarite).toBe('EN_ATTENTE');
    expect(res.version).toBe(2);

    const h = await history(dossier.id);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({
      fromStatus: StatutDossier.BROUILLON,
      toStatus: StatutDossier.SOUMIS,
      changedBy: actor.id,
      comment: 'go',
    });
    expect(h[0].changedAt).toBeInstanceOf(Date);

    const o = await outbox(dossier.id);
    expect(o).toHaveLength(1);
    expect(o[0].eventType).toBe('DossierInscriptionSubmitted');
    expect(o[0].payload).toMatchObject({
      dossierId: dossier.id,
      fromStatus: StatutDossier.BROUILLON,
      toStatus: StatutDossier.SOUMIS,
      version: 2,
      changedBy: actor.id,
      eventType: 'DossierInscriptionSubmitted',
    });
  });

  it('T2 SOUMIS → EN_TRAITEMENT : aucun champ terminal, eventType Processing', async () => {
    const { dossier, actor } = await makeFixtures({ statut: StatutDossier.SOUMIS });

    await service.startProcessing(dossier.id, actor.id, { expectedVersion: 1 });

    const d = await reload(dossier.id);
    expect(d.statutDossier).toBe(StatutDossier.EN_TRAITEMENT);
    expect(d.version).toBe(2);
    expect(d.dateValidation).toBeNull();
    expect(d.validePar).toBeNull();
    expect(d.decisionScolarite).toBe('EN_ATTENTE');

    expect(await history(dossier.id)).toHaveLength(1);
    const o = await outbox(dossier.id);
    expect(o).toHaveLength(1);
    expect(o[0].eventType).toBe('DossierInscriptionProcessing');
  });

  it('T3 EN_TRAITEMENT → INSCRIT : matricule ISSEG-2026-0001, dateValidation+validePar', async () => {
    const { dossier, actor, etudiant } = await makeFixtures({
      statut: StatutDossier.EN_TRAITEMENT,
      matriculeUnique: null,
      anneeDateDebut: new Date(Date.UTC(2026, 8, 1)),
    });

    const before = await readMatriculeSeq(prisma);
    expect(before.isCalled).toBe(false);

    const res = await service.register(dossier.id, actor.id, { expectedVersion: 1 });

    const after = await readMatriculeSeq(prisma);
    expect(after.isCalled).toBe(true); // séquence consommée exactement une fois
    expect(after.lastValue).toBe(1);

    expect(res.matricule).toBe('ISSEG-2026-0001');
    const d = await reload(dossier.id);
    expect(d.statutDossier).toBe(StatutDossier.INSCRIT);
    expect(d.version).toBe(2);
    expect(d.dateValidation).not.toBeNull();
    expect(d.validePar).toBe(actor.id);
    expect(d.decisionScolarite).toBe('EN_ATTENTE');

    const etu = await prisma.etudiant.findUniqueOrThrow({ where: { id: etudiant.id } });
    expect(etu.matriculeUnique).toBe('ISSEG-2026-0001');

    const o = await outbox(dossier.id);
    expect(o).toHaveLength(1);
    expect(o[0].eventType).toBe('DossierInscriptionRegistered');
    expect(o[0].payload).toMatchObject({ matricule: 'ISSEG-2026-0001', toStatus: StatutDossier.INSCRIT });
    expect(await history(dossier.id)).toHaveLength(1);
  });

  it('T4 EN_TRAITEMENT → REJETE : motifRejet persisté + history.comment', async () => {
    const { dossier, actor } = await makeFixtures({ statut: StatutDossier.EN_TRAITEMENT });

    await service.reject(dossier.id, actor.id, { expectedVersion: 1, motifRejet: 'Pièces manquantes' });

    const d = await reload(dossier.id);
    expect(d.statutDossier).toBe(StatutDossier.REJETE);
    expect(d.version).toBe(2);
    expect(d.motifRejet).toBe('Pièces manquantes');
    expect(d.dateValidation).not.toBeNull();
    expect(d.validePar).toBe(actor.id);
    expect(d.decisionScolarite).toBe('EN_ATTENTE');

    const h = await history(dossier.id);
    expect(h).toHaveLength(1);
    expect(h[0].comment).toBe('Pièces manquantes');

    const o = await outbox(dossier.id);
    expect(o).toHaveLength(1);
    expect(o[0].eventType).toBe('DossierInscriptionRejected');
    expect(o[0].payload).toMatchObject({ motifRejet: 'Pièces manquantes' });
  });

  // ── 3. Matricule à vie ───────────────────────────────────────────────────────
  it('Matricule à vie : 2ᵉ inscription conserve le matricule, sans nouveau nextval', async () => {
    const { dossier, actor, etudiant, studentUser } = await makeFixtures({
      statut: StatutDossier.EN_TRAITEMENT,
      matriculeUnique: null,
      anneeDateDebut: new Date(Date.UTC(2026, 8, 1)),
    });

    const r1 = await service.register(dossier.id, actor.id, { expectedVersion: 1 });
    expect(r1.matricule).toBe('ISSEG-2026-0001');
    const seqAfterFirst = await readMatriculeSeq(prisma);

    // 2ᵉ dossier, MÊME étudiant, autre année
    const annee2 = await prisma.anneeUniversitaire.create({
      data: { libelle: uid('AU2'), dateDebut: new Date(Date.UTC(2027, 8, 1)), dateFin: new Date(Date.UTC(2028, 5, 1)) },
    });
    const filiere2 = await prisma.filiere.create({ data: { code: uid('F2'), nom: 'F2' } });
    const classe2 = await prisma.classe.create({
      data: { codeClasse: uid('C2'), libelle: 'C2', niveau: 'L2', filiereId: filiere2.id },
    });
    const dossier2 = await prisma.dossierInscription.create({
      data: {
        etudiantId: etudiant.id,
        anneeId: annee2.id,
        classeId: classe2.id,
        documentsFournis: [],
        statutDossier: StatutDossier.EN_TRAITEMENT,
      },
    });

    const r2 = await service.register(dossier2.id, actor.id, { expectedVersion: 1 });

    expect(r2.matricule).toBe('ISSEG-2026-0001'); // conservé (année de 1ʳᵉ inscription)
    const seqAfterSecond = await readMatriculeSeq(prisma);
    expect(seqAfterSecond.lastValue).toBe(seqAfterFirst.lastValue); // pas de nouveau nextval

    const etu = await prisma.etudiant.findUniqueOrThrow({ where: { id: etudiant.id } });
    expect(etu.matriculeUnique).toBe('ISSEG-2026-0001');
    void studentUser;
  });

  // ── 4. Concurrence ───────────────────────────────────────────────────────────
  it('Concurrence : une seule transition réussit, l’autre 409, une seule écriture', async () => {
    const { dossier, actor } = await makeFixtures({ statut: StatutDossier.BROUILLON });

    const results = await Promise.allSettled([
      service.submit(dossier.id, actor.id, { expectedVersion: 1 }),
      service.submit(dossier.id, actor.id, { expectedVersion: 1 }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    // Contrat normalisé : le perdant reçoit TOUJOURS 409, que sa lecture ait lieu
    // avant le commit (CAS count=0) ou après (version périmée détectée en amont).
    expect(rejected[0].reason).toBeInstanceOf(ConflictException);

    const d = await reload(dossier.id);
    expect(d.statutDossier).toBe(StatutDossier.SOUMIS);
    expect(d.version).toBe(2); // incrémentée une seule fois
    expect(await history(dossier.id)).toHaveLength(1);
    expect(await outbox(dossier.id)).toHaveLength(1);
  });

  // ── 5. Transitions interdites (aucune écriture) ──────────────────────────────
  it('Transitions interdites → 422 et aucune écriture', async () => {
    const cases: Array<{ statut: StatutDossier; run: (id: string, a: string) => Promise<unknown> }> = [
      // saut
      { statut: StatutDossier.BROUILLON, run: (id, a) => service.register(id, a, { expectedVersion: 1 }) },
      // retour arrière (EN_TRAITEMENT -> SOUMIS via submit)
      { statut: StatutDossier.EN_TRAITEMENT, run: (id, a) => service.submit(id, a, { expectedVersion: 1 }) },
      // X -> X
      { statut: StatutDossier.SOUMIS, run: (id, a) => service.submit(id, a, { expectedVersion: 1 }) },
      // INSCRIT -> *
      { statut: StatutDossier.INSCRIT, run: (id, a) => service.startProcessing(id, a, { expectedVersion: 1 }) },
      // REJETE -> *
      { statut: StatutDossier.REJETE, run: (id, a) => service.register(id, a, { expectedVersion: 1 }) },
    ];

    for (const c of cases) {
      const { dossier, actor } = await makeFixtures({ statut: c.statut });
      await expect(c.run(dossier.id, actor.id)).rejects.toMatchObject({ status: 422 });
      const d = await reload(dossier.id);
      expect(d.statutDossier).toBe(c.statut); // inchangé
      expect(d.version).toBe(1);
      expect(await history(dossier.id)).toHaveLength(0);
      expect(await outbox(dossier.id)).toHaveLength(0);
    }
  });

  // ── 6. Rejet : motif invalide → 400, aucune écriture ─────────────────────────
  it('Rejet motif vide/espaces → 400 (ValidationPipe) et aucune écriture', async () => {
    const { dossier, actor } = await makeFixtures({ statut: StatutDossier.EN_TRAITEMENT });

    for (const bad of [undefined, '', '   ']) {
      await expect(validatedRejectDto({ expectedVersion: 1, motifRejet: bad })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      // Le DTO échoue AVANT d'atteindre le service → on ne l'appelle pas.
      const d = await reload(dossier.id);
      expect(d.statutDossier).toBe(StatutDossier.EN_TRAITEMENT);
      expect(await history(dossier.id)).toHaveLength(0);
      expect(await outbox(dossier.id)).toHaveLength(0);
    }

    // Motif valide → passe le DTO puis persiste
    const dto = await validatedRejectDto({ expectedVersion: 1, motifRejet: '  Incomplet  ' });
    await service.reject(dossier.id, actor.id, dto);
    const d = await reload(dossier.id);
    expect(d.statutDossier).toBe(StatutDossier.REJETE);
    expect(d.motifRejet).toBe('Incomplet');
  });

  // ── 7. Rollback T3 (erreur après nextval, sur l’outbox) ──────────────────────
  it('Rollback T3 : erreur sur outbox → dossier/matricule/history/outbox intacts', async () => {
    const { dossier, actor, etudiant } = await makeFixtures({
      statut: StatutDossier.EN_TRAITEMENT,
      matriculeUnique: null,
    });

    const seqBefore = await readMatriculeSeq(prisma); // is_called=false, last=1

    // On enveloppe la vraie transaction et on fait échouer tx.outboxEvent.create.
    // NB : $transaction est surchargée (batch / callback interactif) et ne se type pas
    // proprement via mockImplementation → cast `as any` LOCAL au test (aucun impact métier).
    const realTransaction = prisma.$transaction.bind(prisma);
    const impl = (cb: any, opts: any) =>
      realTransaction(async (tx: any) => {
        const patched = new Proxy(tx, {
          get(target, prop) {
            if (prop === 'outboxEvent') {
              return { create: () => Promise.reject(new Error('boom outbox')) };
            }
            return target[prop];
          },
        });
        return cb(patched);
      }, opts);
    const spy = jest.spyOn(prisma, '$transaction').mockImplementation(impl as any);

    await expect(service.register(dossier.id, actor.id, { expectedVersion: 1 })).rejects.toThrow('boom');
    spy.mockRestore();

    // Tout est rollbacké
    const d = await reload(dossier.id);
    expect(d.statutDossier).toBe(StatutDossier.EN_TRAITEMENT);
    expect(d.version).toBe(1);
    const etu = await prisma.etudiant.findUniqueOrThrow({ where: { id: etudiant.id } });
    expect(etu.matriculeUnique).toBeNull();
    expect(await history(dossier.id)).toHaveLength(0);
    expect(await outbox(dossier.id)).toHaveLength(0);

    // MAIS la séquence a avancé malgré le rollback (nextval non transactionnel) → GAP documenté.
    const seqAfter = await readMatriculeSeq(prisma);
    expect(seqAfter.isCalled).toBe(true);
    expect(seqBefore.isCalled).toBe(false);

    // Preuve du gap : la prochaine inscription réussie saute 0001 → 0002.
    // Autre année (2026) pour respecter @@unique([etudiantId, anneeId]) et garder ISSEG-2026-*.
    const annee3 = await prisma.anneeUniversitaire.create({
      data: { libelle: uid('AU3'), dateDebut: new Date(Date.UTC(2026, 8, 1)), dateFin: new Date(Date.UTC(2027, 5, 1)) },
    });
    const dossierOk = await prisma.dossierInscription.create({
      data: {
        etudiantId: etudiant.id,
        anneeId: annee3.id,
        classeId: dossier.classeId,
        documentsFournis: [],
        statutDossier: StatutDossier.EN_TRAITEMENT,
      },
    });
    const rOk = await service.register(dossierOk.id, actor.id, { expectedVersion: 1 });
    expect(rOk.matricule).toBe('ISSEG-2026-0002'); // 0001 perdu (gap)
  });

  // ── 8. États terminaux ───────────────────────────────────────────────────────
  it('Après INSCRIT : toute transition → 422', async () => {
    const { dossier, actor } = await makeFixtures({ statut: StatutDossier.INSCRIT });
    await expect(service.submit(dossier.id, actor.id, { expectedVersion: 1 })).rejects.toMatchObject({ status: 422 });
    await expect(service.startProcessing(dossier.id, actor.id, { expectedVersion: 1 })).rejects.toMatchObject({ status: 422 });
    await expect(service.register(dossier.id, actor.id, { expectedVersion: 1 })).rejects.toMatchObject({ status: 422 });
    await expect(service.reject(dossier.id, actor.id, { expectedVersion: 1, motifRejet: 'x' })).rejects.toMatchObject({ status: 422 });
    expect(await history(dossier.id)).toHaveLength(0);
    expect(await outbox(dossier.id)).toHaveLength(0);
  });

  it('Après REJETE : toute transition → 422', async () => {
    const { dossier, actor } = await makeFixtures({ statut: StatutDossier.REJETE });
    await expect(service.submit(dossier.id, actor.id, { expectedVersion: 1 })).rejects.toMatchObject({ status: 422 });
    await expect(service.startProcessing(dossier.id, actor.id, { expectedVersion: 1 })).rejects.toMatchObject({ status: 422 });
    await expect(service.register(dossier.id, actor.id, { expectedVersion: 1 })).rejects.toMatchObject({ status: 422 });
    await expect(service.reject(dossier.id, actor.id, { expectedVersion: 1, motifRejet: 'x' })).rejects.toMatchObject({ status: 422 });
    expect(await history(dossier.id)).toHaveLength(0);
    expect(await outbox(dossier.id)).toHaveLength(0);
  });
});
