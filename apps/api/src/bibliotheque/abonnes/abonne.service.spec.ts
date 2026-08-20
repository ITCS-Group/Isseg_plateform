import { ConflictException, NotFoundException } from '@nestjs/common';
import { TypeAbonne } from '@prisma/client';
import { AbonneService } from './abonne.service';

interface PrismaMock {
  utilisateur: { findUnique: jest.Mock };
  abonne: { findUnique: jest.Mock; create: jest.Mock; findMany: jest.Mock };
}

describe('AbonneService', () => {
  let service: AbonneService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      utilisateur: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', nom: 'N', prenom: 'P' }) },
      abonne: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'ab-1',
          utilisateurId: 'user-1',
          typeAbonne: TypeAbonne.ENSEIGNANT,
          dateDebut: new Date(),
          dateFin: null,
          statutActif: true,
          limiteEmprunts: 10,
          dureePretJours: 30,
          createdAt: new Date(),
          updatedAt: new Date(),
          utilisateur: { nom: 'N', prenom: 'P' },
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    service = new AbonneService(prisma as never);
  });

  it('utilisateur introuvable → NotFoundException', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue(null);
    await expect(
      service.create({ utilisateurId: 'x', typeAbonne: TypeAbonne.ENSEIGNANT }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('utilisateur déjà abonné → ConflictException', async () => {
    prisma.abonne.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(
      service.create({ utilisateurId: 'user-1', typeAbonne: TypeAbonne.ENSEIGNANT }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('création : limiteEmprunts/dureePretJours dérivés du TypeAbonne (ENSEIGNANT → 10/30)', async () => {
    await service.create({ utilisateurId: 'user-1', typeAbonne: TypeAbonne.ENSEIGNANT });

    expect(prisma.abonne.create.mock.calls[0][0].data).toMatchObject({
      utilisateurId: 'user-1',
      typeAbonne: TypeAbonne.ENSEIGNANT,
      limiteEmprunts: 10,
      dureePretJours: 30,
    });
  });
});
