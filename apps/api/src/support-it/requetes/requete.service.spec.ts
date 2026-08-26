import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { NatureRequete, StatutRequete, SousServiceIT } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import { RequeteService } from './requete.service';

interface PrismaMock {
  personnel: { findUnique: jest.Mock };
  technicien: { findFirst: jest.Mock };
  requete: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
}

const DEMANDEUR = { utilisateur: { nom: 'Diallo', prenom: 'Fatou' } };

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'req-1',
    demandeurId: 'pers-1',
    nature: NatureRequete.PANNE_MATERIEL,
    sousServiceCible: SousServiceIT.MAINTENANCE,
    description: 'Écran cassé',
    statut: StatutRequete.OUVERTE,
    dateOuverture: new Date(),
    dateCloture: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    demandeur: DEMANDEUR,
    ...overrides,
  };
}

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

describe('RequeteService', () => {
  let service: RequeteService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      personnel: { findUnique: jest.fn().mockResolvedValue({ id: 'pers-1' }) },
      technicien: { findFirst: jest.fn().mockResolvedValue(null) },
      requete: {
        create: jest.fn().mockResolvedValue(makeRow()),
        findMany: jest.fn().mockResolvedValue([makeRow()]),
        findUnique: jest.fn().mockResolvedValue(makeRow()),
        update: jest.fn().mockResolvedValue(makeRow({ statut: StatutRequete.CLOTUREE, dateCloture: new Date() })),
      },
    };
    service = new RequeteService(prisma as never);
  });

  describe('create', () => {
    it('aucun profil Personnel → ForbiddenException', async () => {
      prisma.personnel.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ nature: NatureRequete.PANNE_MATERIEL, description: 'x'.repeat(10) }, 'user-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('route automatiquement vers le bon sous-service (PANNE_MATERIEL → MAINTENANCE)', async () => {
      await service.create({ nature: NatureRequete.PANNE_MATERIEL, description: 'Écran cassé' }, 'user-1');
      expect(prisma.requete.create).toHaveBeenCalledWith({
        data: {
          demandeurId: 'pers-1',
          nature: NatureRequete.PANNE_MATERIEL,
          sousServiceCible: SousServiceIT.MAINTENANCE,
          description: 'Écran cassé',
        },
        select: expect.anything(),
      });
    });

    it('route INCIDENT_SECURITE → CYBER', async () => {
      await service.create({ nature: NatureRequete.INCIDENT_SECURITE, description: 'Phishing détecté' }, 'user-1');
      expect(prisma.requete.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sousServiceCible: SousServiceIT.CYBER }) }),
      );
    });
  });

  describe('findAll', () => {
    it('appelant sans profil Personnel ni Technicien → liste vide', async () => {
      prisma.personnel.findUnique.mockResolvedValue(null);
      const result = await service.findAll({}, makeUser({ roles: ['ETUDIANT'] }));
      expect(result).toEqual([]);
      expect(prisma.requete.findMany).not.toHaveBeenCalled();
    });

    it('demandeur → filtre sur son propre demandeurId', async () => {
      await service.findAll({}, makeUser({ roles: ['ENSEIGNANT'] }));
      expect(prisma.requete.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ demandeurId: 'pers-1' }) }),
      );
    });

    it('TECHNICIEN → filtre sur le sous-service de son profil Technicien', async () => {
      prisma.technicien.findFirst.mockResolvedValue({ id: 'tech-1', sousService: SousServiceIT.CYBER });
      await service.findAll({}, makeUser({ roles: ['TECHNICIEN'] }));
      expect(prisma.requete.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ sousServiceCible: SousServiceIT.CYBER }) }),
      );
    });

    it('RESPONSABLE_IT → aucun filtre de périmètre', async () => {
      await service.findAll({}, makeUser({ roles: ['RESPONSABLE_IT'] }));
      expect(prisma.requete.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.not.objectContaining({ demandeurId: expect.anything() }) }),
      );
    });
  });

  describe('findOne', () => {
    it('requête introuvable → NotFoundException', async () => {
      prisma.requete.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing', makeUser())).rejects.toBeInstanceOf(NotFoundException);
    });

    it('demandeur différent, non technicien/responsable → ForbiddenException', async () => {
      prisma.personnel.findUnique.mockResolvedValue({ id: 'un-autre-personnel' });
      await expect(service.findOne('req-1', makeUser())).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('cloturer', () => {
    it('déjà clôturée → ConflictException', async () => {
      prisma.requete.findUnique.mockResolvedValue(makeRow({ statut: StatutRequete.CLOTUREE }));
      await expect(service.cloturer('req-1', makeUser({ roles: ['RESPONSABLE_IT'] }))).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('technicien d’un autre sous-service → ForbiddenException', async () => {
      prisma.technicien.findFirst.mockResolvedValue({ id: 'tech-1', sousService: SousServiceIT.CENTRE_INFORMATIQUE });
      await expect(service.cloturer('req-1', makeUser({ roles: ['TECHNICIEN'] }))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('RESPONSABLE_IT → clôture réussie', async () => {
      const result = await service.cloturer('req-1', makeUser({ roles: ['RESPONSABLE_IT'] }));
      expect(result.statut).toBe(StatutRequete.CLOTUREE);
      expect(prisma.requete.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'req-1' },
          data: expect.objectContaining({ statut: StatutRequete.CLOTUREE }),
        }),
      );
    });
  });
});
