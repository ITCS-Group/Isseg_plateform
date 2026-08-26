import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { StatutRequete, SousServiceIT } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import { InterventionService } from './intervention.service';

interface PrismaMock {
  requete: { findUnique: jest.Mock; update: jest.Mock };
  technicien: { findFirst: jest.Mock };
  personnel: { findUnique: jest.Mock };
  intervention: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock };
  $transaction: jest.Mock;
}

const PAGE_1 = { page: 1, limit: 20 };

const REQUETE = {
  id: 'req-1',
  demandeurId: 'pers-1',
  sousServiceCible: SousServiceIT.MAINTENANCE,
  statut: StatutRequete.OUVERTE,
};

const TECHNICIEN = { id: 'tech-1', sousService: SousServiceIT.MAINTENANCE };

const INTERVENTION_ROW = {
  id: 'int-1',
  requeteId: 'req-1',
  technicienId: 'tech-1',
  date: new Date(),
  compteRendu: 'Remplacement écran',
  createdAt: new Date(),
  updatedAt: new Date(),
  technicien: { personnel: { utilisateur: { nom: 'Camara', prenom: 'Ibrahim' } } },
};

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'user-1',
    email: 'u@isseg.local',
    nom: 'Test',
    prenom: 'User',
    estActif: true,
    roles: ['TECHNICIEN'],
    permissions: [],
    ...overrides,
  };
}

describe('InterventionService', () => {
  let service: InterventionService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      requete: { findUnique: jest.fn().mockResolvedValue(REQUETE), update: jest.fn() },
      technicien: { findFirst: jest.fn().mockResolvedValue(TECHNICIEN) },
      personnel: { findUnique: jest.fn().mockResolvedValue(null) },
      intervention: {
        create: jest.fn().mockResolvedValue(INTERVENTION_ROW),
        findMany: jest.fn().mockResolvedValue([INTERVENTION_ROW]),
        count: jest.fn().mockResolvedValue(1),
      },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    service = new InterventionService(prisma as never);
  });

  describe('create', () => {
    it('requête introuvable → NotFoundException', async () => {
      prisma.requete.findUnique.mockResolvedValue(null);
      await expect(service.create('req-1', { compteRendu: 'x'.repeat(10) }, 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('requête clôturée → ConflictException', async () => {
      prisma.requete.findUnique.mockResolvedValue({ ...REQUETE, statut: StatutRequete.CLOTUREE });
      await expect(service.create('req-1', { compteRendu: 'x'.repeat(10) }, 'user-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('aucun profil Technicien → ForbiddenException', async () => {
      prisma.technicien.findFirst.mockResolvedValue(null);
      await expect(service.create('req-1', { compteRendu: 'x'.repeat(10) }, 'user-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('technicien d’un autre sous-service → ForbiddenException', async () => {
      prisma.technicien.findFirst.mockResolvedValue({ id: 'tech-2', sousService: SousServiceIT.CYBER });
      await expect(service.create('req-1', { compteRendu: 'x'.repeat(10) }, 'user-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('requête OUVERTE → intervention créée + statut passé à EN_COURS', async () => {
      const result = await service.create('req-1', { compteRendu: 'Remplacement écran' }, 'user-1');
      expect(result.id).toBe('int-1');
      expect(prisma.requete.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { statut: StatutRequete.EN_COURS },
      });
    });

    it('requête déjà EN_COURS → pas de mise à jour de statut', async () => {
      prisma.requete.findUnique.mockResolvedValue({ ...REQUETE, statut: StatutRequete.EN_COURS });
      await service.create('req-1', { compteRendu: 'Suivi' }, 'user-1');
      expect(prisma.requete.update).not.toHaveBeenCalled();
    });
  });

  describe('findAllForRequete', () => {
    it('requête introuvable → NotFoundException', async () => {
      prisma.requete.findUnique.mockResolvedValue(null);
      await expect(service.findAllForRequete('req-1', PAGE_1, makeUser())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('appelant hors périmètre → ForbiddenException', async () => {
      prisma.technicien.findFirst.mockResolvedValue({ id: 'tech-2', sousService: SousServiceIT.CYBER });
      await expect(
        service.findAllForRequete('req-1', PAGE_1, makeUser({ roles: ['TECHNICIEN'] })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('technicien du bon sous-service → liste paginée retournée', async () => {
      const result = await service.findAllForRequete('req-1', PAGE_1, makeUser());
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('int-1');
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
    });
  });
});
