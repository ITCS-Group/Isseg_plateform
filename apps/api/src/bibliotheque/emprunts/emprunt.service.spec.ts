import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { StatutEmprunt, StatutOuvrage, TypeAbonne } from '@prisma/client';
import { EmpruntService } from './emprunt.service';

interface PrismaMock {
  ouvrage: { findUnique: jest.Mock; update: jest.Mock; findUniqueOrThrow: jest.Mock };
  abonne: { findUnique: jest.Mock };
  etudiant: { findUnique: jest.Mock };
  emprunt: { count: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; findMany: jest.Mock };
  $transaction: jest.Mock;
}

const OUVRAGE = {
  id: 'ouv-1',
  titre: 'Livre Test',
  nombreExemplaires: 3,
  exemplairesDisponibles: 2,
  statut: StatutOuvrage.DISPONIBLE,
};

const ABONNE = {
  id: 'ab-1',
  utilisateurId: 'user-1',
  typeAbonne: TypeAbonne.ETUDIANT_L1_L2,
  statutActif: true,
  limiteEmprunts: 3,
  dureePretJours: 14,
};

const EMPRUNT_ROW = {
  id: 'emp-1',
  ouvrageId: 'ouv-1',
  emprunteurId: 'user-1',
  dateEmprunt: new Date(),
  dateRetourPrevue: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  dateRetourEffectif: null,
  renouvellementsRestants: 1,
  statut: StatutEmprunt.EN_COURS,
  retardJours: 0,
  montantPenalite: 0,
  penalitesPayees: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ouvrage: { titre: 'Livre Test' },
  emprunteur: { nom: 'Etu', prenom: 'Diant' },
};

describe('EmpruntService', () => {
  let service: EmpruntService;
  let prisma: PrismaMock;
  let regularityService: { checkRegularity: jest.Mock };

  beforeEach(() => {
    prisma = {
      ouvrage: {
        findUnique: jest.fn().mockResolvedValue(OUVRAGE),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue(OUVRAGE),
      },
      abonne: { findUnique: jest.fn().mockResolvedValue(ABONNE) },
      etudiant: { findUnique: jest.fn().mockResolvedValue(null) },
      emprunt: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(EMPRUNT_ROW),
        create: jest.fn().mockResolvedValue(EMPRUNT_ROW),
        update: jest.fn().mockResolvedValue(EMPRUNT_ROW),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    regularityService = { checkRegularity: jest.fn() };
    service = new EmpruntService(prisma as never, regularityService as never);
  });

  describe('create', () => {
    it('ouvrage introuvable → NotFoundException', async () => {
      prisma.ouvrage.findUnique.mockResolvedValue(null);
      await expect(service.create({ ouvrageId: 'x', emprunteurId: 'user-1' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('aucun exemplaire disponible → ConflictException', async () => {
      prisma.ouvrage.findUnique.mockResolvedValue({ ...OUVRAGE, exemplairesDisponibles: 0 });
      await expect(service.create({ ouvrageId: 'ouv-1', emprunteurId: 'user-1' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('aucun profil abonné → NotFoundException', async () => {
      prisma.abonne.findUnique.mockResolvedValue(null);
      await expect(service.create({ ouvrageId: 'ouv-1', emprunteurId: 'user-1' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('abonnement inactif → ForbiddenException', async () => {
      prisma.abonne.findUnique.mockResolvedValue({ ...ABONNE, statutActif: false });
      await expect(service.create({ ouvrageId: 'ouv-1', emprunteurId: 'user-1' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('étudiant non régulier → ForbiddenException, aucune écriture', async () => {
      prisma.etudiant.findUnique.mockResolvedValue({ matriculeUnique: 'ISSEG-2026-0001' });
      regularityService.checkRegularity.mockResolvedValue({
        isRegular: false,
        reason: 'Frais non soldés',
      });

      await expect(service.create({ ouvrageId: 'ouv-1', emprunteurId: 'user-1' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.emprunt.create).not.toHaveBeenCalled();
    });

    it('non-étudiant (pas de fiche Etudiant) → régularité non vérifiée, emprunt créé', async () => {
      prisma.etudiant.findUnique.mockResolvedValue(null);
      const result = await service.create({ ouvrageId: 'ouv-1', emprunteurId: 'user-1' });

      expect(regularityService.checkRegularity).not.toHaveBeenCalled();
      expect(result.id).toBe('emp-1');
    });

    it('étudiant régulier → régularité vérifiée, emprunt créé', async () => {
      prisma.etudiant.findUnique.mockResolvedValue({ matriculeUnique: 'ISSEG-2026-0001' });
      regularityService.checkRegularity.mockResolvedValue({ isRegular: true });

      const result = await service.create({ ouvrageId: 'ouv-1', emprunteurId: 'user-1' });

      expect(regularityService.checkRegularity).toHaveBeenCalledWith('ISSEG-2026-0001');
      expect(result.id).toBe('emp-1');
    });

    it('quota atteint (empruntsEnCours >= limiteEmprunts) → ConflictException', async () => {
      prisma.emprunt.count.mockResolvedValue(3);
      await expect(service.create({ ouvrageId: 'ouv-1', emprunteurId: 'user-1' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('création : décrémente exemplairesDisponibles, ne passe pas EMPRUNTE si encore disponible', async () => {
      await service.create({ ouvrageId: 'ouv-1', emprunteurId: 'user-1' });

      expect(prisma.ouvrage.update).toHaveBeenCalledWith({
        where: { id: 'ouv-1' },
        data: { exemplairesDisponibles: 1, statut: StatutOuvrage.DISPONIBLE },
      });
    });

    it('création : dernier exemplaire → ouvrage passe en statut EMPRUNTE', async () => {
      prisma.ouvrage.findUnique.mockResolvedValue({ ...OUVRAGE, exemplairesDisponibles: 1 });
      await service.create({ ouvrageId: 'ouv-1', emprunteurId: 'user-1' });

      expect(prisma.ouvrage.update).toHaveBeenCalledWith({
        where: { id: 'ouv-1' },
        data: { exemplairesDisponibles: 0, statut: StatutOuvrage.EMPRUNTE },
      });
    });

    it('dateRetourPrevue = dateEmprunt + dureePretJours de l’abonné', async () => {
      const result = await service.create({ ouvrageId: 'ouv-1', emprunteurId: 'user-1' });
      const createCall = prisma.emprunt.create.mock.calls[0][0];
      const diffJours =
        (createCall.data.dateRetourPrevue.getTime() - createCall.data.dateEmprunt.getTime()) /
        (24 * 60 * 60 * 1000);
      expect(diffJours).toBeCloseTo(14, 5);
      void result;
    });
  });

  describe('retour', () => {
    it('emprunt introuvable → NotFoundException', async () => {
      prisma.emprunt.findUnique.mockResolvedValue(null);
      await expect(service.retour('x')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('déjà retourné → ConflictException', async () => {
      prisma.emprunt.findUnique.mockResolvedValue({ ...EMPRUNT_ROW, statut: StatutEmprunt.RETOURNE });
      await expect(service.retour('emp-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('retour à temps → retardJours = 0', async () => {
      const futur = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      prisma.emprunt.findUnique.mockResolvedValue({ ...EMPRUNT_ROW, dateRetourPrevue: futur });

      await service.retour('emp-1');

      expect(prisma.emprunt.update.mock.calls[0][0].data.retardJours).toBe(0);
      expect(prisma.emprunt.update.mock.calls[0][0].data.statut).toBe(StatutEmprunt.RETOURNE);
    });

    it('retour en retard → retardJours > 0', async () => {
      const passe = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      prisma.emprunt.findUnique.mockResolvedValue({ ...EMPRUNT_ROW, dateRetourPrevue: passe });

      await service.retour('emp-1');

      expect(prisma.emprunt.update.mock.calls[0][0].data.retardJours).toBeGreaterThanOrEqual(3);
    });

    it('retour : incrémente exemplairesDisponibles et repasse DISPONIBLE si EMPRUNTE', async () => {
      prisma.ouvrage.findUniqueOrThrow.mockResolvedValue({
        ...OUVRAGE,
        exemplairesDisponibles: 0,
        statut: StatutOuvrage.EMPRUNTE,
      });

      await service.retour('emp-1');

      expect(prisma.ouvrage.update).toHaveBeenCalledWith({
        where: { id: 'ouv-1' },
        data: { exemplairesDisponibles: 1, statut: StatutOuvrage.DISPONIBLE },
      });
    });

    it('retour : exemplairesDisponibles ne dépasse jamais nombreExemplaires', async () => {
      prisma.ouvrage.findUniqueOrThrow.mockResolvedValue({
        ...OUVRAGE,
        nombreExemplaires: 3,
        exemplairesDisponibles: 3,
      });

      await service.retour('emp-1');

      expect(prisma.ouvrage.update.mock.calls[0][0].data.exemplairesDisponibles).toBe(3);
    });
  });

  describe('findAll — scoping', () => {
    it('ETUDIANT : emprunteurId forcé à son propre id, filtre query ignoré', async () => {
      prisma.emprunt.findMany = jest.fn().mockResolvedValue([]);
      await service.findAll(
        { emprunteurId: 'autre-utilisateur' },
        { id: 'user-1', roles: ['ETUDIANT'] },
      );

      expect(prisma.emprunt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ emprunteurId: 'user-1' }) }),
      );
    });

    it('BIBLIOTHECAIRE : filtre query respecté (non forcé)', async () => {
      prisma.emprunt.findMany = jest.fn().mockResolvedValue([]);
      await service.findAll(
        { emprunteurId: 'autre-utilisateur' },
        { id: 'bib-1', roles: ['BIBLIOTHECAIRE'] },
      );

      expect(prisma.emprunt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ emprunteurId: 'autre-utilisateur' }) }),
      );
    });
  });
});
