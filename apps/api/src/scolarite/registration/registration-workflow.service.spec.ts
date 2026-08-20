import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { StatutDossier } from '@prisma/client';
import { RegistrationWorkflowService } from './registration-workflow.service';

// ── Mock Prisma (client interactif) ──────────────────────────────────────────
interface TxMock {
  dossierInscription: { findUnique: jest.Mock; updateMany: jest.Mock };
  etudiant: { update: jest.Mock };
  abonne: { upsert: jest.Mock };
  registrationHistory: { create: jest.Mock };
  outboxEvent: { create: jest.Mock };
  $queryRaw: jest.Mock;
}

const ACTOR = 'user-actor-1';

function makeDossier(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dossier-1',
    etudiantId: 'etu-1',
    anneeId: 'annee-1',
    classeId: 'classe-1',
    statutDossier: StatutDossier.BROUILLON,
    version: 1,
    etudiant: { id: 'etu-1', matriculeUnique: null as string | null, userId: 'user-etu-1' },
    anneeUniversitaire: { id: 'annee-1', dateDebut: new Date(Date.UTC(2026, 8, 1)) },
    classe: { niveau: 'L1' },
    ...overrides,
  };
}

describe('RegistrationWorkflowService', () => {
  let service: RegistrationWorkflowService;
  let tx: TxMock;
  let prisma: { $transaction: jest.Mock };

  beforeEach(() => {
    tx = {
      dossierInscription: { findUnique: jest.fn(), updateMany: jest.fn() },
      etudiant: { update: jest.fn() },
      abonne: { upsert: jest.fn() },
      registrationHistory: { create: jest.fn() },
      outboxEvent: { create: jest.fn() },
      $queryRaw: jest.fn(),
    };
    // Défauts "happy path"
    tx.dossierInscription.updateMany.mockResolvedValue({ count: 1 });
    tx.etudiant.update.mockResolvedValue({});
    tx.abonne.upsert.mockResolvedValue({});
    tx.registrationHistory.create.mockResolvedValue({});
    tx.outboxEvent.create.mockResolvedValue({});
    tx.$queryRaw.mockResolvedValue([{ seq: '1' }]);

    prisma = { $transaction: jest.fn((cb: (t: TxMock) => unknown) => cb(tx)) };
    service = new RegistrationWorkflowService(prisma as never);
  });

  // Helpers d'accès aux arguments capturés
  const updateData = () => tx.dossierInscription.updateMany.mock.calls[0][0].data;
  const updateWhere = () => tx.dossierInscription.updateMany.mock.calls[0][0].where;
  const historyData = () => tx.registrationHistory.create.mock.calls[0][0].data;
  const outboxData = () => tx.outboxEvent.create.mock.calls[0][0].data;

  function expectNoWrites() {
    expect(tx.dossierInscription.updateMany).not.toHaveBeenCalled();
    expect(tx.etudiant.update).not.toHaveBeenCalled();
    expect(tx.abonne.upsert).not.toHaveBeenCalled();
    expect(tx.registrationHistory.create).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  }

  // ── Erreurs ─────────────────────────────────────────────────────────────────
  describe('404 — dossier inexistant', () => {
    it('lève NotFoundException et n’écrit rien', async () => {
      tx.dossierInscription.findUnique.mockResolvedValue(null);
      await expect(service.submit('absent', ACTOR, { expectedVersion: 1 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expectNoWrites();
    });
  });

  describe('422 — transition interdite', () => {
    it('saut BROUILLON → INSCRIT (register)', async () => {
      tx.dossierInscription.findUnique.mockResolvedValue(
        makeDossier({ statutDossier: StatutDossier.BROUILLON }),
      );
      await expect(service.register('d', ACTOR, { expectedVersion: 1 })).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expectNoWrites();
    });

    it('X → X (submit sur SOUMIS)', async () => {
      tx.dossierInscription.findUnique.mockResolvedValue(
        makeDossier({ statutDossier: StatutDossier.SOUMIS }),
      );
      await expect(service.submit('d', ACTOR, { expectedVersion: 1 })).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expectNoWrites();
    });

    it('sortie d’un état terminal (register sur INSCRIT) avec version correcte', async () => {
      tx.dossierInscription.findUnique.mockResolvedValue(
        makeDossier({ statutDossier: StatutDossier.INSCRIT, version: 5 }),
      );
      await expect(service.register('d', ACTOR, { expectedVersion: 5 })).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expectNoWrites();
    });
  });

  describe('409 — version périmée (précède la garde métier)', () => {
    it('version courante ≠ expectedVersion → ConflictException avant tout CAS', async () => {
      tx.dossierInscription.findUnique.mockResolvedValue(
        makeDossier({ statutDossier: StatutDossier.BROUILLON, version: 7 }),
      );
      // Transition en soi valide (BROUILLON→SOUMIS), mais version périmée
      await expect(service.submit('d', ACTOR, { expectedVersion: 1 })).rejects.toBeInstanceOf(
        ConflictException,
      );
      // 409 levé AVANT la garde et le CAS → aucune écriture
      expectNoWrites();
    });

    it('version périmée PRIME sur une transition interdite (409, pas 422)', async () => {
      tx.dossierInscription.findUnique.mockResolvedValue(
        makeDossier({ statutDossier: StatutDossier.INSCRIT, version: 9 }),
      );
      // Transition interdite (terminal) ET version périmée → 409 doit primer
      await expect(service.register('d', ACTOR, { expectedVersion: 1 })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expectNoWrites();
    });
  });

  describe('409 — optimistic locking', () => {
    it('updateMany count=0 → ConflictException, aucune écriture ultérieure', async () => {
      tx.dossierInscription.findUnique.mockResolvedValue(
        makeDossier({ statutDossier: StatutDossier.BROUILLON }),
      );
      tx.dossierInscription.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.submit('d', ACTOR, { expectedVersion: 1 })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(tx.dossierInscription.updateMany).toHaveBeenCalledTimes(1);
      expect(tx.$queryRaw).not.toHaveBeenCalled();
      expect(tx.etudiant.update).not.toHaveBeenCalled();
      expect(tx.registrationHistory.create).not.toHaveBeenCalled();
      expect(tx.outboxEvent.create).not.toHaveBeenCalled();
    });
  });

  // ── T1 : BROUILLON → SOUMIS ───────────────────────────────────────────────
  describe('T1 — BROUILLON → SOUMIS', () => {
    beforeEach(() => {
      tx.dossierInscription.findUnique.mockResolvedValue(
        makeDossier({ statutDossier: StatutDossier.BROUILLON, version: 3 }),
      );
    });

    it('applique le bon patch + CAS + version + 1 history + 1 outbox', async () => {
      const res = await service.submit('dossier-1', ACTOR, { expectedVersion: 3, comment: 'ok' });

      // CAS : where id + version + statut
      expect(updateWhere()).toMatchObject({
        id: 'dossier-1',
        version: 3,
        statutDossier: StatutDossier.BROUILLON,
      });
      // Patch : uniquement dateSoumission (aucun champ terminal, pas de motif)
      const data = updateData();
      expect(data.statutDossier).toBe(StatutDossier.SOUMIS);
      expect(data.version).toEqual({ increment: 1 });
      expect(data.dateSoumission).toBeInstanceOf(Date);
      expect(data.dateValidation).toBeUndefined();
      expect(data.validePar).toBeUndefined();
      expect(data.motifRejet).toBeUndefined();
      // decisionScolarite jamais touché
      expect('decisionScolarite' in data).toBe(false);

      // version incrémentée
      expect(res.version).toBe(4);

      // Exactement 1 history + 1 outbox
      expect(tx.registrationHistory.create).toHaveBeenCalledTimes(1);
      expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
      expect(historyData()).toMatchObject({
        dossierId: 'dossier-1',
        fromStatus: StatutDossier.BROUILLON,
        toStatus: StatutDossier.SOUMIS,
        changedBy: ACTOR,
        comment: 'ok',
      });
      expect(outboxData().eventType).toBe('DossierInscriptionSubmitted');
      expect(outboxData().aggregateId).toBe('dossier-1');
      expect(outboxData().payload).toMatchObject({
        fromStatus: StatutDossier.BROUILLON,
        toStatus: StatutDossier.SOUMIS,
        version: 4,
        changedBy: ACTOR,
        eventType: 'DossierInscriptionSubmitted',
      });
      expect(typeof outboxData().payload.changedAt).toBe('string');
      // Pas de matricule pour T1
      expect(tx.$queryRaw).not.toHaveBeenCalled();
      expect(outboxData().payload.matricule).toBeUndefined();
      // Pas d'auto-abonnement hors transition vers INSCRIT
      expect(tx.abonne.upsert).not.toHaveBeenCalled();
    });
  });

  // ── T2 : SOUMIS → EN_TRAITEMENT ───────────────────────────────────────────
  describe('T2 — SOUMIS → EN_TRAITEMENT', () => {
    it('aucun champ terminal, pas de dateSoumission, eventType Processing', async () => {
      tx.dossierInscription.findUnique.mockResolvedValue(
        makeDossier({ statutDossier: StatutDossier.SOUMIS, version: 2 }),
      );
      const res = await service.startProcessing('dossier-1', ACTOR, { expectedVersion: 2 });

      const data = updateData();
      expect(data.statutDossier).toBe(StatutDossier.EN_TRAITEMENT);
      expect(data.dateSoumission).toBeUndefined();
      expect(data.dateValidation).toBeUndefined();
      expect(data.validePar).toBeUndefined();
      expect(data.motifRejet).toBeUndefined();
      expect(res.version).toBe(3);
      expect(tx.registrationHistory.create).toHaveBeenCalledTimes(1);
      expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
      expect(outboxData().eventType).toBe('DossierInscriptionProcessing');
      expect(tx.$queryRaw).not.toHaveBeenCalled();
      expect(tx.abonne.upsert).not.toHaveBeenCalled();
    });
  });

  // ── T3 : EN_TRAITEMENT → INSCRIT ──────────────────────────────────────────
  describe('T3 — EN_TRAITEMENT → INSCRIT', () => {
    it('nouveau matricule : nextval 1x, ISSEG-2026-0001, dateValidation + validePar', async () => {
      tx.dossierInscription.findUnique.mockResolvedValue(
        makeDossier({
          statutDossier: StatutDossier.EN_TRAITEMENT,
          version: 4,
          etudiant: { id: 'etu-1', matriculeUnique: null, userId: 'user-etu-1' },
        }),
      );
      const res = await service.register('dossier-1', ACTOR, { expectedVersion: 4 });

      const data = updateData();
      expect(data.statutDossier).toBe(StatutDossier.INSCRIT);
      expect(data.dateValidation).toBeInstanceOf(Date);
      expect(data.validePar).toBe(ACTOR);
      expect(data.dateSoumission).toBeUndefined();
      expect(data.motifRejet).toBeUndefined();

      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(tx.etudiant.update).toHaveBeenCalledTimes(1);
      expect(tx.etudiant.update.mock.calls[0][0]).toMatchObject({
        where: { id: 'etu-1' },
        data: { matriculeUnique: 'ISSEG-2026-0001' },
      });
      expect(res.matricule).toBe('ISSEG-2026-0001');
      expect(res.version).toBe(5);

      expect(tx.registrationHistory.create).toHaveBeenCalledTimes(1);
      expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
      expect(outboxData().eventType).toBe('DossierInscriptionRegistered');
      expect(outboxData().payload).toMatchObject({
        toStatus: StatutDossier.INSCRIT,
        matricule: 'ISSEG-2026-0001',
      });

      // Auto-abonnement Bibliothèque : niveau L1 (défaut fixture) → ETUDIANT_L1_L2
      expect(tx.abonne.upsert).toHaveBeenCalledTimes(1);
      expect(tx.abonne.upsert.mock.calls[0][0]).toMatchObject({
        where: { utilisateurId: 'user-etu-1' },
        create: { utilisateurId: 'user-etu-1', typeAbonne: 'ETUDIANT_L1_L2', limiteEmprunts: 3, dureePretJours: 14 },
      });
    });

    it('matricule existant : aucun nextval, matricule conservé', async () => {
      tx.dossierInscription.findUnique.mockResolvedValue(
        makeDossier({
          statutDossier: StatutDossier.EN_TRAITEMENT,
          version: 4,
          etudiant: { id: 'etu-1', matriculeUnique: 'ISSEG-2025-0007', userId: 'user-etu-1' },
        }),
      );
      const res = await service.register('dossier-1', ACTOR, { expectedVersion: 4 });

      expect(tx.$queryRaw).not.toHaveBeenCalled();
      expect(tx.etudiant.update).not.toHaveBeenCalled();
      expect(res.matricule).toBe('ISSEG-2025-0007');
      expect(outboxData().payload.matricule).toBe('ISSEG-2025-0007');
      // Réinscription : l'auto-abonnement reste appelé (idempotent via upsert)
      expect(tx.abonne.upsert).toHaveBeenCalledTimes(1);
    });

    it('niveau L3 → typeAbonne ETUDIANT_L3_M2, quota/durée correspondants', async () => {
      tx.dossierInscription.findUnique.mockResolvedValue(
        makeDossier({
          statutDossier: StatutDossier.EN_TRAITEMENT,
          version: 4,
          etudiant: { id: 'etu-1', matriculeUnique: null, userId: 'user-etu-1' },
          classe: { niveau: 'L3' },
        }),
      );
      await service.register('dossier-1', ACTOR, { expectedVersion: 4 });

      expect(tx.abonne.upsert.mock.calls[0][0]).toMatchObject({
        where: { utilisateurId: 'user-etu-1' },
        create: { utilisateurId: 'user-etu-1', typeAbonne: 'ETUDIANT_L3_M2', limiteEmprunts: 5, dureePretJours: 21 },
      });
    });

    it.each([
      ['1', 'ISSEG-2026-0001'],
      ['25', 'ISSEG-2026-0025'],
      ['1234', 'ISSEG-2026-1234'],
      ['10000', 'ISSEG-2026-10000'],
    ])('padding séquence %s → %s (jamais tronqué)', async (seq, expected) => {
      tx.$queryRaw.mockResolvedValue([{ seq }]);
      tx.dossierInscription.findUnique.mockResolvedValue(
        makeDossier({
          statutDossier: StatutDossier.EN_TRAITEMENT,
          version: 1,
          etudiant: { id: 'etu-1', matriculeUnique: null },
        }),
      );
      const res = await service.register('dossier-1', ACTOR, { expectedVersion: 1 });
      expect(res.matricule).toBe(expected);
    });

    it('année issue de dateDebut.getUTCFullYear() (jamais la date système)', async () => {
      tx.dossierInscription.findUnique.mockResolvedValue(
        makeDossier({
          statutDossier: StatutDossier.EN_TRAITEMENT,
          version: 1,
          etudiant: { id: 'etu-1', matriculeUnique: null },
          anneeUniversitaire: { id: 'a', dateDebut: new Date(Date.UTC(2030, 0, 15)) },
        }),
      );
      const res = await service.register('dossier-1', ACTOR, { expectedVersion: 1 });
      expect(res.matricule).toBe('ISSEG-2030-0001');
      expect(res.matricule).not.toContain(String(new Date().getUTCFullYear()));
    });
  });

  // ── T4 : EN_TRAITEMENT → REJETE ───────────────────────────────────────────
  describe('T4 — EN_TRAITEMENT → REJETE', () => {
    it('motif enregistré sur le dossier + repris dans history.comment', async () => {
      tx.dossierInscription.findUnique.mockResolvedValue(
        makeDossier({ statutDossier: StatutDossier.EN_TRAITEMENT, version: 4 }),
      );
      const res = await service.reject('dossier-1', ACTOR, {
        expectedVersion: 4,
        motifRejet: 'Dossier incomplet',
      });

      const data = updateData();
      expect(data.statutDossier).toBe(StatutDossier.REJETE);
      expect(data.motifRejet).toBe('Dossier incomplet');
      expect(data.dateValidation).toBeInstanceOf(Date);
      expect(data.validePar).toBe(ACTOR);
      expect(data.dateSoumission).toBeUndefined();

      expect(historyData().comment).toBe('Dossier incomplet');
      expect(res.version).toBe(5);
      expect(tx.registrationHistory.create).toHaveBeenCalledTimes(1);
      expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
      expect(outboxData().eventType).toBe('DossierInscriptionRejected');
      expect(outboxData().payload.motifRejet).toBe('Dossier incomplet');
      // Pas de matricule pour un rejet
      expect(tx.$queryRaw).not.toHaveBeenCalled();
      expect(outboxData().payload.matricule).toBeUndefined();
      expect(tx.abonne.upsert).not.toHaveBeenCalled();
    });
  });

  // ── Atomicité logique : un échec stoppe les écritures suivantes ────────────
  describe('atomicité — arrêt sur erreur', () => {
    it('échec après nextval (etudiant.update rejette) → pas de history ni outbox', async () => {
      tx.dossierInscription.findUnique.mockResolvedValue(
        makeDossier({
          statutDossier: StatutDossier.EN_TRAITEMENT,
          version: 1,
          etudiant: { id: 'etu-1', matriculeUnique: null },
        }),
      );
      tx.etudiant.update.mockRejectedValue(new Error('boom persist matricule'));

      await expect(service.register('dossier-1', ACTOR, { expectedVersion: 1 })).rejects.toThrow(
        'boom',
      );

      expect(tx.$queryRaw).toHaveBeenCalledTimes(1); // numéro tiré (potentiellement "brûlé")
      expect(tx.registrationHistory.create).not.toHaveBeenCalled();
      expect(tx.outboxEvent.create).not.toHaveBeenCalled();
    });

    it('échec sur history.create → outbox non créé', async () => {
      tx.dossierInscription.findUnique.mockResolvedValue(
        makeDossier({ statutDossier: StatutDossier.SOUMIS, version: 1 }),
      );
      tx.registrationHistory.create.mockRejectedValue(new Error('boom history'));

      await expect(
        service.startProcessing('dossier-1', ACTOR, { expectedVersion: 1 }),
      ).rejects.toThrow('boom');

      expect(tx.outboxEvent.create).not.toHaveBeenCalled();
    });
  });
});
