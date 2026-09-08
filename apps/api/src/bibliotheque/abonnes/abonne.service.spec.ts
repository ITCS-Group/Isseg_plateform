import { ConflictException, NotFoundException } from '@nestjs/common';
import { TypeAbonne } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { AbonneService } from './abonne.service';

interface PrismaMock {
  utilisateur: { findUnique: jest.Mock };
  abonne: { findUnique: jest.Mock; create: jest.Mock; findMany: jest.Mock; count: jest.Mock };
  auditLog: {
    create: jest.Mock;
  };
  /** Transaction interactive : le callback reçoit le mock lui-même. */
  $transaction: jest.Mock;
}

/** Pagination par défaut (cf. PaginationDto) — page 1, 20 éléments. */
const PAGE_DEFAUT = { page: 1, limit: 20 };

const ABONNE_ROW = {
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
};

/** Acteur des mutations. Prisma est mocké : aucune contrainte de clé étrangère. */
const acteurId = 'acteur-1';

describe('AbonneService', () => {
  let service: AbonneService;
  let audit: AuditService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      utilisateur: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', nom: 'N', prenom: 'P' }) },
      abonne: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(ABONNE_ROW),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    audit = new AuditService();
    jest.spyOn(audit, 'record');
    service = new AbonneService(prisma as never, audit);
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

  it('utilisateur introuvable → NotFoundException', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue(null);
    await expect(
      service.create({ utilisateurId: 'x', typeAbonne: TypeAbonne.ENSEIGNANT }, acteurId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('utilisateur déjà abonné → ConflictException', async () => {
    prisma.abonne.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(
      service.create({ utilisateurId: 'user-1', typeAbonne: TypeAbonne.ENSEIGNANT }, acteurId),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('création : limiteEmprunts/dureePretJours dérivés du TypeAbonne (ENSEIGNANT → 10/30)', async () => {
    await service.create({ utilisateurId: 'user-1', typeAbonne: TypeAbonne.ENSEIGNANT }, acteurId);

    expect(prisma.abonne.create.mock.calls[0][0].data).toMatchObject({
      utilisateurId: 'user-1',
      typeAbonne: TypeAbonne.ENSEIGNANT,
      limiteEmprunts: 10,
      dureePretJours: 30,
    });
  });

  // ── findAll — pagination (BACK-02-A) ────────────────────────────────────────
  describe('findAll — pagination', () => {
    it('page par défaut : renvoie {data, meta} avec skip=0/take=20', async () => {
      prisma.abonne.findMany.mockResolvedValue([ABONNE_ROW]);
      prisma.abonne.count.mockResolvedValue(1);

      const result = await service.findAll({ ...PAGE_DEFAUT });

      expect(prisma.abonne.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
    });

    it('meta.total reflète le comptage réel de la table', async () => {
      prisma.abonne.findMany.mockResolvedValue([ABONNE_ROW]);
      prisma.abonne.count.mockResolvedValue(120);

      const result = await service.findAll({ ...PAGE_DEFAUT });

      expect(prisma.abonne.count).toHaveBeenCalled();
      expect(result.meta).toEqual({ total: 120, page: 1, limit: 20, totalPages: 6 });
    });

    it('dernière page partielle : skip/take corrects, totalPages arrondi au supérieur', async () => {
      prisma.abonne.findMany.mockResolvedValue([ABONNE_ROW]);
      prisma.abonne.count.mockResolvedValue(41);

      const result = await service.findAll({ page: 3, limit: 20 });

      expect(prisma.abonne.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
      expect(result.meta).toEqual({ total: 41, page: 3, limit: 20, totalPages: 3 });
      expect(result.data).toHaveLength(1);
    });

    it('collection vide : totalPages plancher à 1', async () => {
      prisma.abonne.findMany.mockResolvedValue([]);
      prisma.abonne.count.mockResolvedValue(0);

      const result = await service.findAll({ ...PAGE_DEFAUT });

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 1 });
    });

    it('limit personnalisé : skip/take suivent la page demandée', async () => {
      prisma.abonne.findMany.mockResolvedValue([ABONNE_ROW]);
      prisma.abonne.count.mockResolvedValue(7);

      const result = await service.findAll({ page: 2, limit: 3 });

      expect(prisma.abonne.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 3, take: 3 }),
      );
      expect(result.meta).toEqual({ total: 7, page: 2, limit: 3, totalPages: 3 });
    });
  });

  // ── Audit métier (BACK-01, lot 3) ──────────────────────────────────────────

  describe('audit métier', () => {
    it('create : CREATE sur l\'abonné, l\'utilisateur abonné restant un détail', async () => {
      prisma.abonne.findUnique.mockResolvedValue(null);
      await service.create({ utilisateurId: 'u-1', typeAbonne: 'ENSEIGNANT' } as never, acteurId);

      const e = dernierAudit();
      expect(e.action).toBe('CREATE');
      expect(e.entity).toBe('Abonne');
      expect(e.actorId).toBe(acteurId);
      // La personne abonnée n'est PAS l'acteur.
      expect(e.details).toMatchObject({ utilisateurId: 'u-1' });
      expect(e.actorId).not.toBe('u-1');
    });

    it('l\'audit passe par le client de la transaction', async () => {
      prisma.abonne.findUnique.mockResolvedValue(null);
      await service.create({ utilisateurId: 'u-1', typeAbonne: 'ENSEIGNANT' } as never, acteurId);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(clientDuDernierAudit()).toBe(prisma);
    });

    it('un refus métier avant la transaction n\'écrit aucun audit', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ utilisateurId: 'inconnu', typeAbonne: 'ENSEIGNANT' } as never, acteurId),
      ).rejects.toBeDefined();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });
});
