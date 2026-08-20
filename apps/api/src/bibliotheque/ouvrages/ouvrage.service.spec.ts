import { ConflictException, NotFoundException } from '@nestjs/common';
import { StatutOuvrage } from '@prisma/client';
import { OuvrageService } from './ouvrage.service';

interface PrismaMock {
  ouvrage: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
  sectionBibliotheque: { findUnique: jest.Mock };
  emprunt: { count: jest.Mock };
}

const SECTION = { id: 'sec-1', code: 'OG', nom: 'Ouvrages Généraux' };

const OUVRAGE_ROW = {
  id: 'ouv-1',
  isbn: null,
  titre: 'Livre',
  auteur: 'Auteur',
  editeur: 'Editeur',
  anneeEdition: 2020,
  cote: 'A-001',
  classificationDewey: null,
  matieres: ['Éducation'],
  salle: 'S1',
  etagere: 'E1',
  nombreExemplaires: 2,
  exemplairesDisponibles: 2,
  statut: StatutOuvrage.DISPONIBLE,
  sectionId: 'sec-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  section: { nom: 'Ouvrages Généraux' },
};

describe('OuvrageService', () => {
  let service: OuvrageService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      ouvrage: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(OUVRAGE_ROW),
        create: jest.fn().mockResolvedValue(OUVRAGE_ROW),
        update: jest.fn().mockResolvedValue(OUVRAGE_ROW),
        delete: jest.fn(),
      },
      sectionBibliotheque: { findUnique: jest.fn().mockResolvedValue(SECTION) },
      emprunt: { count: jest.fn().mockResolvedValue(0) },
    };
    service = new OuvrageService(prisma as never);
  });

  describe('create', () => {
    it('section introuvable → NotFoundException', async () => {
      prisma.sectionBibliotheque.findUnique.mockResolvedValue(null);
      await expect(
        service.create({
          titre: 'T',
          auteur: 'A',
          editeur: 'E',
          anneeEdition: 2020,
          cote: 'C',
          matieres: ['x'],
          salle: 'S',
          etagere: 'E1',
          nombreExemplaires: 2,
          sectionId: 'sec-x',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('exemplairesDisponibles initialisé à nombreExemplaires', async () => {
      await service.create({
        titre: 'T',
        auteur: 'A',
        editeur: 'E',
        anneeEdition: 2020,
        cote: 'C',
        matieres: ['x'],
        salle: 'S',
        etagere: 'E1',
        nombreExemplaires: 5,
        sectionId: 'sec-1',
      });

      expect(prisma.ouvrage.create.mock.calls[0][0].data).toMatchObject({
        nombreExemplaires: 5,
        exemplairesDisponibles: 5,
      });
    });
  });

  describe('update', () => {
    it('ouvrage introuvable → NotFoundException', async () => {
      prisma.ouvrage.findUnique.mockResolvedValue(null);
      await expect(service.update('x', {})).rejects.toBeInstanceOf(NotFoundException);
    });

    it('augmentation de nombreExemplaires : exemplairesDisponibles suit le delta', async () => {
      await service.update('ouv-1', { nombreExemplaires: 4 });

      // base : nombreExemplaires 2 → 4 (+2), exemplairesDisponibles 2 → 4
      expect(prisma.ouvrage.update.mock.calls[0][0].data.exemplairesDisponibles).toBe(4);
    });

    it('réduction de nombreExemplaires : exemplairesDisponibles ne descend jamais sous 0', async () => {
      prisma.ouvrage.findUnique.mockResolvedValue({ ...OUVRAGE_ROW, exemplairesDisponibles: 1, nombreExemplaires: 2 });
      await service.update('ouv-1', { nombreExemplaires: 0 });

      expect(prisma.ouvrage.update.mock.calls[0][0].data.exemplairesDisponibles).toBe(0);
    });
  });

  describe('remove', () => {
    it('emprunts en cours → ConflictException, pas de suppression', async () => {
      prisma.emprunt.count.mockResolvedValue(2);
      await expect(service.remove('ouv-1')).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.ouvrage.delete).not.toHaveBeenCalled();
    });

    it('aucun emprunt en cours → suppression effectuée', async () => {
      await service.remove('ouv-1');
      expect(prisma.ouvrage.delete).toHaveBeenCalledWith({ where: { id: 'ouv-1' } });
    });
  });
});
