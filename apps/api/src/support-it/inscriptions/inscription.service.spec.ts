import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma, StatutInscriptionCoursSupportIT } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import { AttestationService } from '../attestations/attestation.service';
import { InscriptionCoursSupportITService } from './inscription.service';

interface PrismaMock {
  coursSupportIT: { findUnique: jest.Mock };
  inscriptionCoursSupportIT: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  evaluationSupportIT: { findUnique: jest.Mock; create: jest.Mock };
  $transaction: jest.Mock;
}

const COURS = { id: 'cours-1', titre: 'Bureautique niveau 1' };

const INSCRIPTION_ROW = {
  id: 'insc-1',
  participantId: 'user-1',
  coursId: 'cours-1',
  statut: StatutInscriptionCoursSupportIT.EN_COURS,
  progression: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  cours: COURS,
};

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'user-1',
    email: 'u@isseg.local',
    nom: 'Test',
    prenom: 'User',
    estActif: true,
    roles: ['ENSEIGNANT'],
    permissions: [],
    ...overrides,
  };
}

describe('InscriptionCoursSupportITService', () => {
  let service: InscriptionCoursSupportITService;
  let prisma: PrismaMock;
  let attestationService: AttestationService;

  beforeEach(() => {
    prisma = {
      coursSupportIT: { findUnique: jest.fn().mockResolvedValue(COURS) },
      inscriptionCoursSupportIT: {
        create: jest.fn().mockResolvedValue(INSCRIPTION_ROW),
        findMany: jest.fn().mockResolvedValue([INSCRIPTION_ROW]),
        findUnique: jest.fn().mockResolvedValue({
          ...INSCRIPTION_ROW,
          cours: { titre: 'Bureautique niveau 1' },
          participant: { nom: 'Bah', prenom: 'Mamadou' },
        }),
        update: jest.fn(),
      },
      evaluationSupportIT: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'eval-1',
          inscriptionId: 'insc-1',
          note: 15,
          date: new Date(),
          statutReussite: true,
        }),
      },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    attestationService = new AttestationService();
    service = new InscriptionCoursSupportITService(prisma as never, attestationService);
  });

  describe('enroll', () => {
    it('cours introuvable → NotFoundException', async () => {
      prisma.coursSupportIT.findUnique.mockResolvedValue(null);
      await expect(service.enroll('cours-x', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('déjà inscrit (P2002) → ConflictException', async () => {
      prisma.inscriptionCoursSupportIT.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'x' }),
      );
      await expect(service.enroll('cours-1', 'user-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('inscription réussie', async () => {
      const result = await service.enroll('cours-1', 'user-1');
      expect(result.id).toBe('insc-1');
      expect(result.coursTitre).toBe('Bureautique niveau 1');
    });
  });

  describe('findAll', () => {
    it('participant → filtre sur son propre id', async () => {
      await service.findAll(makeUser());
      expect(prisma.inscriptionCoursSupportIT.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { participantId: 'user-1' } }),
      );
    });

    it('RESPONSABLE_IT → pas de filtre', async () => {
      await service.findAll(makeUser({ roles: ['RESPONSABLE_IT'] }));
      expect(prisma.inscriptionCoursSupportIT.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  describe('findOne', () => {
    it('introuvable → NotFoundException', async () => {
      prisma.inscriptionCoursSupportIT.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing', makeUser())).rejects.toBeInstanceOf(NotFoundException);
    });

    it('autre participant, non unscoped → ForbiddenException', async () => {
      await expect(service.findOne('insc-1', makeUser({ id: 'autre-user' }))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('evaluer', () => {
    it('inscription introuvable → NotFoundException', async () => {
      prisma.inscriptionCoursSupportIT.findUnique.mockResolvedValue(null);
      await expect(service.evaluer('missing', { note: 15, statutReussite: true })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('déjà évaluée → ConflictException', async () => {
      prisma.evaluationSupportIT.findUnique.mockResolvedValue({ id: 'eval-existing' });
      await expect(service.evaluer('insc-1', { note: 15, statutReussite: true })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('réussite → attestation générée dans la réponse', async () => {
      const result = await service.evaluer('insc-1', { note: 16, statutReussite: true });
      expect(result.attestation).toBeDefined();
      expect(result.attestation?.coursTitre).toBe('Bureautique niveau 1');
      expect(prisma.inscriptionCoursSupportIT.update).toHaveBeenCalledWith({
        where: { id: 'insc-1' },
        data: { statut: StatutInscriptionCoursSupportIT.TERMINE },
      });
    });

    it('échec → pas d’attestation', async () => {
      prisma.evaluationSupportIT.create.mockResolvedValue({
        id: 'eval-2',
        inscriptionId: 'insc-1',
        note: 5,
        date: new Date(),
        statutReussite: false,
      });
      const result = await service.evaluer('insc-1', { note: 5, statutReussite: false });
      expect(result.attestation).toBeUndefined();
    });
  });
});
