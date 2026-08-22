import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, StatutAbandon } from '@prisma/client';
import { AbandonService } from './abandon.service';
import { DecisionReprise } from './dto/decider-reprise.dto';

// ── Mock Prisma (client interactif) ──────────────────────────────────────────
interface TxMock {
  abandon: {
    findUnique: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    create: jest.Mock;
    updateMany: jest.Mock;
  };
  inscription: { findUnique: jest.Mock; update: jest.Mock };
}

const ACTOR = 'user-actor-1';

function makeAbandon(overrides: Record<string, unknown> = {}) {
  return {
    id: 'abandon-1',
    etudiantId: 'etu-1',
    anneeId: 'annee-1',
    statut: StatutAbandon.CONSTATE,
    dateConstat: new Date('2026-01-01'),
    signaleParId: 'user-signale-1',
    dateDemandeReprise: null,
    dateDecisionReprise: null,
    decideParId: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('AbandonService', () => {
  let service: AbandonService;
  let tx: TxMock;
  let prisma: { $transaction: jest.Mock };

  beforeEach(() => {
    tx = {
      abandon: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      inscription: { findUnique: jest.fn(), update: jest.fn() },
    };
    tx.abandon.updateMany.mockResolvedValue({ count: 1 });
    tx.inscription.update.mockResolvedValue({});

    prisma = { $transaction: jest.fn((cb: (t: TxMock) => unknown) => cb(tx)) };
    service = new AbandonService(prisma as never);
  });

  // ── signaler() ───────────────────────────────────────────────────────────
  describe('signaler', () => {
    it('crée l\'Abandon (CONSTATE) et désactive l\'inscription correspondante', async () => {
      tx.inscription.findUnique.mockResolvedValue({ id: 'inscription-1', etudiantId: 'etu-1', anneeId: 'annee-1' });
      tx.abandon.create.mockResolvedValue(makeAbandon());

      const result = await service.signaler({ etudiantId: 'etu-1', anneeId: 'annee-1' }, ACTOR);

      expect(tx.abandon.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { etudiantId: 'etu-1', anneeId: 'annee-1', signaleParId: ACTOR } }),
      );
      expect(tx.inscription.update).toHaveBeenCalledWith({
        where: { id: 'inscription-1' },
        data: { estActive: false },
      });
      expect(result.statut).toBe(StatutAbandon.CONSTATE);
    });

    it('lève NotFoundException si aucune inscription ne correspond, sans créer l\'abandon', async () => {
      tx.inscription.findUnique.mockResolvedValue(null);

      await expect(
        service.signaler({ etudiantId: 'etu-1', anneeId: 'annee-1' }, ACTOR),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(tx.abandon.create).not.toHaveBeenCalled();
      expect(tx.inscription.update).not.toHaveBeenCalled();
    });

    it('lève ConflictException (409) sur doublon étudiant+année (P2002)', async () => {
      tx.inscription.findUnique.mockResolvedValue({ id: 'inscription-1', etudiantId: 'etu-1', anneeId: 'annee-1' });
      tx.abandon.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'x' }),
      );

      await expect(
        service.signaler({ etudiantId: 'etu-1', anneeId: 'annee-1' }, ACTOR),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tx.inscription.update).not.toHaveBeenCalled();
    });
  });

  // ── demanderReprise() ────────────────────────────────────────────────────
  describe('demanderReprise', () => {
    it('CONSTATE → REPRISE_DEMANDEE : statut + dateDemandeReprise', async () => {
      tx.abandon.findUnique.mockResolvedValue(makeAbandon({ statut: StatutAbandon.CONSTATE }));
      tx.abandon.findUniqueOrThrow.mockResolvedValue(
        makeAbandon({ statut: StatutAbandon.REPRISE_DEMANDEE, dateDemandeReprise: new Date() }),
      );

      const result = await service.demanderReprise('abandon-1');

      expect(tx.abandon.updateMany).toHaveBeenCalledWith({
        where: { id: 'abandon-1', statut: StatutAbandon.CONSTATE },
        data: expect.objectContaining({ statut: StatutAbandon.REPRISE_DEMANDEE }),
      });
      expect(result.statut).toBe(StatutAbandon.REPRISE_DEMANDEE);
    });

    it('lève NotFoundException si l\'abandon est introuvable', async () => {
      tx.abandon.findUnique.mockResolvedValue(null);
      await expect(service.demanderReprise('absent')).rejects.toBeInstanceOf(NotFoundException);
      expect(tx.abandon.updateMany).not.toHaveBeenCalled();
    });

    it('lève UnprocessableEntityException (422) depuis un état terminal', async () => {
      tx.abandon.findUnique.mockResolvedValue(makeAbandon({ statut: StatutAbandon.REPRISE_ACCORDEE }));
      await expect(service.demanderReprise('abandon-1')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(tx.abandon.updateMany).not.toHaveBeenCalled();
    });

    it('lève ConflictException (409) sur conflit de concurrence (CAS count=0)', async () => {
      tx.abandon.findUnique.mockResolvedValue(makeAbandon({ statut: StatutAbandon.CONSTATE }));
      tx.abandon.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.demanderReprise('abandon-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('REPRISE_REFUSEE → REPRISE_DEMANDEE : un refus n\'est pas définitif, le recours est autorisé', async () => {
      tx.abandon.findUnique.mockResolvedValue(makeAbandon({ statut: StatutAbandon.REPRISE_REFUSEE }));
      tx.abandon.findUniqueOrThrow.mockResolvedValue(
        makeAbandon({ statut: StatutAbandon.REPRISE_DEMANDEE, dateDemandeReprise: new Date() }),
      );

      const result = await service.demanderReprise('abandon-1');

      expect(tx.abandon.updateMany).toHaveBeenCalledWith({
        where: { id: 'abandon-1', statut: StatutAbandon.REPRISE_REFUSEE },
        data: expect.objectContaining({ statut: StatutAbandon.REPRISE_DEMANDEE }),
      });
      expect(result.statut).toBe(StatutAbandon.REPRISE_DEMANDEE);
    });
  });

  // ── deciderReprise() ─────────────────────────────────────────────────────
  describe('deciderReprise', () => {
    it('ACCORDEE : REPRISE_DEMANDEE → REPRISE_ACCORDEE et réactive l\'inscription', async () => {
      tx.abandon.findUnique.mockResolvedValue(
        makeAbandon({ statut: StatutAbandon.REPRISE_DEMANDEE, etudiantId: 'etu-1', anneeId: 'annee-1' }),
      );
      tx.abandon.findUniqueOrThrow.mockResolvedValue(
        makeAbandon({ statut: StatutAbandon.REPRISE_ACCORDEE, decideParId: ACTOR }),
      );

      const result = await service.deciderReprise('abandon-1', ACTOR, { decision: DecisionReprise.ACCORDEE });

      expect(tx.inscription.update).toHaveBeenCalledWith({
        where: { etudiantId_anneeId: { etudiantId: 'etu-1', anneeId: 'annee-1' } },
        data: { estActive: true },
      });
      expect(result.statut).toBe(StatutAbandon.REPRISE_ACCORDEE);
    });

    it('REFUSEE : REPRISE_DEMANDEE → REPRISE_REFUSEE sans toucher à l\'inscription', async () => {
      tx.abandon.findUnique.mockResolvedValue(makeAbandon({ statut: StatutAbandon.REPRISE_DEMANDEE }));
      tx.abandon.findUniqueOrThrow.mockResolvedValue(
        makeAbandon({ statut: StatutAbandon.REPRISE_REFUSEE, decideParId: ACTOR }),
      );

      const result = await service.deciderReprise('abandon-1', ACTOR, { decision: DecisionReprise.REFUSEE });

      expect(tx.inscription.update).not.toHaveBeenCalled();
      expect(result.statut).toBe(StatutAbandon.REPRISE_REFUSEE);
    });

    it('lève UnprocessableEntityException (422) si le statut courant n\'est pas REPRISE_DEMANDEE', async () => {
      tx.abandon.findUnique.mockResolvedValue(makeAbandon({ statut: StatutAbandon.CONSTATE }));
      await expect(
        service.deciderReprise('abandon-1', ACTOR, { decision: DecisionReprise.ACCORDEE }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(tx.inscription.update).not.toHaveBeenCalled();
    });

    it('lève ConflictException (409) sur conflit de concurrence (CAS count=0)', async () => {
      tx.abandon.findUnique.mockResolvedValue(makeAbandon({ statut: StatutAbandon.REPRISE_DEMANDEE }));
      tx.abandon.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.deciderReprise('abandon-1', ACTOR, { decision: DecisionReprise.ACCORDEE }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tx.inscription.update).not.toHaveBeenCalled();
    });
  });
});
