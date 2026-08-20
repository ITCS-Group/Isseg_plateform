import { ConflictException, NotFoundException } from '@nestjs/common';
import { StatutReservation } from '@prisma/client';
import { ReservationService } from './reservation.service';

interface PrismaMock {
  ouvrage: { findUnique: jest.Mock };
  abonne: { findUnique: jest.Mock };
  reservation: { findFirst: jest.Mock; create: jest.Mock };
}

describe('ReservationService', () => {
  let service: ReservationService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      ouvrage: {
        findUnique: jest.fn().mockResolvedValue({ id: 'ouv-1', titre: 'Livre', exemplairesDisponibles: 0 }),
      },
      abonne: { findUnique: jest.fn().mockResolvedValue({ id: 'ab-1' }) },
      reservation: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'res-1',
          ouvrageId: 'ouv-1',
          abonneId: 'ab-1',
          dateReservation: new Date(),
          statut: StatutReservation.EN_ATTENTE,
          createdAt: new Date(),
          updatedAt: new Date(),
          ouvrage: { titre: 'Livre' },
        }),
      },
    };
    service = new ReservationService(prisma as never);
  });

  it('ouvrage introuvable → NotFoundException', async () => {
    prisma.ouvrage.findUnique.mockResolvedValue(null);
    await expect(service.create({ ouvrageId: 'x' }, 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('exemplaires disponibles → ConflictException (emprunter, pas réserver)', async () => {
    prisma.ouvrage.findUnique.mockResolvedValue({ id: 'ouv-1', titre: 'Livre', exemplairesDisponibles: 2 });
    await expect(service.create({ ouvrageId: 'ouv-1' }, 'user-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('aucun profil abonné → NotFoundException', async () => {
    prisma.abonne.findUnique.mockResolvedValue(null);
    await expect(service.create({ ouvrageId: 'ouv-1' }, 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('réservation déjà en attente → ConflictException', async () => {
    prisma.reservation.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(service.create({ ouvrageId: 'ouv-1' }, 'user-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('création réussie', async () => {
    const result = await service.create({ ouvrageId: 'ouv-1' }, 'user-1');
    expect(result.id).toBe('res-1');
    expect(prisma.reservation.create).toHaveBeenCalledWith({
      data: { ouvrageId: 'ouv-1', abonneId: 'ab-1' },
      select: expect.anything(),
    });
  });
});
