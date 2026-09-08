import { ConflictException, NotFoundException } from '@nestjs/common';
import { StatutOuvrage } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { OuvrageService } from './ouvrage.service';

interface PrismaMock {
  ouvrage: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  sectionBibliotheque: { findUnique: jest.Mock };
  emprunt: { count: jest.Mock };
  auditLog: {
    create: jest.Mock;
  };
  /** Transaction interactive : le callback reçoit le mock lui-même. */
  $transaction: jest.Mock;
}

/** Pagination par défaut (cf. PaginationDto) — page 1, 20 éléments. */
const PAGE_DEFAUT = { page: 1, limit: 20 };

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

/** Acteur des mutations. Prisma est mocké : aucune contrainte de clé étrangère. */
const acteurId = 'acteur-1';

describe('OuvrageService', () => {
  let service: OuvrageService;
  let audit: AuditService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      ouvrage: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(OUVRAGE_ROW),
        create: jest.fn().mockResolvedValue(OUVRAGE_ROW),
        update: jest.fn().mockResolvedValue(OUVRAGE_ROW),
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      sectionBibliotheque: { findUnique: jest.fn().mockResolvedValue(SECTION) },
      emprunt: { count: jest.fn().mockResolvedValue(0) },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    audit = new AuditService();
    jest.spyOn(audit, 'record');
    service = new OuvrageService(prisma as never, audit);
  });

  /** Dernière entrée soumise à AuditService, et client utilisé pour l'écrire. */
  function dernierAudit() {
    const appels = (audit.record as jest.Mock).mock.calls;
    return appels[appels.length - 1][1];
  }
  function clientDuDernierAudit() {
    const appels = (audit.record as jest.Mock).mock.calls;
    return appels[appels.length - 1][0];
  }

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
        }, acteurId),
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
      }, acteurId);

      expect(prisma.ouvrage.create.mock.calls[0][0].data).toMatchObject({
        nombreExemplaires: 5,
        exemplairesDisponibles: 5,
      });
    });
  });

  describe('update', () => {
    it('ouvrage introuvable → NotFoundException', async () => {
      prisma.ouvrage.findUnique.mockResolvedValue(null);
      await expect(service.update('x', {}, acteurId)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('augmentation de nombreExemplaires : exemplairesDisponibles suit le delta', async () => {
      await service.update('ouv-1', { nombreExemplaires: 4 }, acteurId);

      // base : nombreExemplaires 2 → 4 (+2), exemplairesDisponibles 2 → 4
      expect(prisma.ouvrage.update.mock.calls[0][0].data.exemplairesDisponibles).toBe(4);
    });

    it('réduction de nombreExemplaires : exemplairesDisponibles ne descend jamais sous 0', async () => {
      prisma.ouvrage.findUnique.mockResolvedValue({ ...OUVRAGE_ROW, exemplairesDisponibles: 1, nombreExemplaires: 2 });
      await service.update('ouv-1', { nombreExemplaires: 0 }, acteurId);

      expect(prisma.ouvrage.update.mock.calls[0][0].data.exemplairesDisponibles).toBe(0);
    });
  });

  describe('remove', () => {
    it('emprunts en cours → ConflictException, pas de suppression', async () => {
      prisma.emprunt.count.mockResolvedValue(2);
      await expect(service.remove('ouv-1', acteurId)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.ouvrage.delete).not.toHaveBeenCalled();
    });

    it('aucun emprunt en cours → suppression effectuée', async () => {
      await service.remove('ouv-1', acteurId);
      expect(prisma.ouvrage.delete).toHaveBeenCalledWith({ where: { id: 'ouv-1' } });
    });
  });

  // ── findAll — pagination (BACK-02-A) ────────────────────────────────────────
  describe('findAll — pagination', () => {
    it('page par défaut : renvoie {data, meta} avec skip=0/take=20', async () => {
      prisma.ouvrage.findMany.mockResolvedValue([OUVRAGE_ROW]);
      prisma.ouvrage.count.mockResolvedValue(1);

      const result = await service.findAll({ ...PAGE_DEFAUT });

      expect(prisma.ouvrage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
    });

    it('count reçoit exactement le même `where` que findMany', async () => {
      prisma.ouvrage.findMany.mockResolvedValue([OUVRAGE_ROW]);
      prisma.ouvrage.count.mockResolvedValue(37);

      const result = await service.findAll({
        ...PAGE_DEFAUT,
        statut: StatutOuvrage.DISPONIBLE,
        sectionId: 'sec-1',
      });

      const whereFindMany = prisma.ouvrage.findMany.mock.calls[0][0].where;
      const whereCount = prisma.ouvrage.count.mock.calls[0][0].where;
      expect(whereCount).toEqual(whereFindMany);
      expect(result.meta.total).toBe(37);
    });

    it('dernière page partielle : skip/take corrects, totalPages arrondi au supérieur', async () => {
      prisma.ouvrage.findMany.mockResolvedValue([OUVRAGE_ROW]);
      prisma.ouvrage.count.mockResolvedValue(45);

      const result = await service.findAll({ page: 3, limit: 20 });

      expect(prisma.ouvrage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
      expect(result.meta).toEqual({ total: 45, page: 3, limit: 20, totalPages: 3 });
    });

    it('collection vide : totalPages plancher à 1', async () => {
      prisma.ouvrage.findMany.mockResolvedValue([]);
      prisma.ouvrage.count.mockResolvedValue(0);

      const result = await service.findAll({ ...PAGE_DEFAUT });

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 1 });
    });

    it('pagination + recherche `q` : le OR titre/auteur reste appliqué', async () => {
      prisma.ouvrage.findMany.mockResolvedValue([OUVRAGE_ROW]);
      prisma.ouvrage.count.mockResolvedValue(9);

      const result = await service.findAll({ page: 2, limit: 5, q: 'pedagogie' });

      const call = prisma.ouvrage.findMany.mock.calls[0][0];
      expect(call.skip).toBe(5);
      expect(call.take).toBe(5);
      expect(JSON.stringify(call.where.OR)).toContain('pedagogie');
      expect(result.meta).toEqual({ total: 9, page: 2, limit: 5, totalPages: 2 });
    });
  });

  // ── Audit métier (BACK-01, lot 3) ──────────────────────────────────────────

  describe('audit métier', () => {
    it('create : CREATE sur l\'ouvrage, attribué à l\'acteur', async () => {
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
      } as never, acteurId);

      const e = dernierAudit();
      expect(e.action).toBe('CREATE');
      expect(e.entity).toBe('Ouvrage');
      expect(e.actorId).toBe(acteurId);
      expect(e.actorId).not.toBe(e.entityId);
    });

    it('update : UPDATE, seuls les noms des champs modifiés', async () => {
      await service.update('ouv-1', { titre: 'Nouveau titre' } as never, acteurId);

      const e = dernierAudit();
      expect(e.action).toBe('UPDATE');
      expect(e.entity).toBe('Ouvrage');
      expect(e.entityId).toBe('ouv-1');
      expect(e.details).toEqual({ champsModifies: ['titre'] });
    });

    it('remove : DELETE conservant cote et titre capturés avant suppression', async () => {
      prisma.emprunt.count.mockResolvedValue(0);
      await service.remove('ouv-1', acteurId);

      const e = dernierAudit();
      expect(e.action).toBe('DELETE');
      expect(e.entityId).toBe('ouv-1');
      expect(e.details).toMatchObject({ cote: expect.any(String) });
    });

    it('l\'audit passe par le client de la transaction', async () => {
      prisma.emprunt.count.mockResolvedValue(0);
      await service.remove('ouv-1', acteurId);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(clientDuDernierAudit()).toBe(prisma);
    });

    it('un refus métier avant la transaction n\'écrit aucun audit', async () => {
      prisma.emprunt.count.mockResolvedValue(2);

      await expect(service.remove('ouv-1', acteurId)).rejects.toBeDefined();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });
});
