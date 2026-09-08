import { NotFoundException } from '@nestjs/common';
import { StatutPoste } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PosteService } from './poste.service';

interface PrismaMock {
  poste: {
    create: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    groupBy: jest.Mock;
  };
  auditLog: { create: jest.Mock };
  /** Transaction interactive : le callback reçoit le mock lui-même. */
  $transaction: jest.Mock;
}

const POSTE = {
  id: 'poste-1',
  salle: 'Salle A',
  statut: StatutPoste.DISPONIBLE,
  dateDerniereMaintenance: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/** Acteur des mutations. Prisma est mocké : aucune contrainte de clé étrangère. */
const acteurId = 'acteur-1';

describe('PosteService', () => {
  let service: PosteService;
  let audit: AuditService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      poste: {
        create: jest.fn().mockResolvedValue(POSTE),
        findMany: jest.fn().mockResolvedValue([POSTE]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(POSTE),
        update: jest.fn().mockResolvedValue({ ...POSTE, statut: StatutPoste.HORS_SERVICE }),
        groupBy: jest.fn().mockResolvedValue([
          { salle: 'Salle A', statut: StatutPoste.DISPONIBLE, _count: { _all: 3 } },
          { salle: 'Salle A', statut: StatutPoste.HORS_SERVICE, _count: { _all: 1 } },
          { salle: 'Salle B', statut: StatutPoste.DISPONIBLE, _count: { _all: 2 } },
        ]),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    audit = new AuditService();
    jest.spyOn(audit, 'record');
    service = new PosteService(prisma as never, audit);
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

  it('create : crée le poste', async () => {
    const result = await service.create({ salle: 'Salle A' }, acteurId);
    expect(result.id).toBe('poste-1');
  });

  it('findAll : pagine avec skip/take et renvoie meta', async () => {
    prisma.poste.count.mockResolvedValue(42);
    const result = await service.findAll({ page: 2, limit: 10 });
    expect(prisma.poste.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(result.meta).toEqual({ total: 42, page: 2, limit: 10, totalPages: 5 });
  });

  it('findOne : introuvable → NotFoundException', async () => {
    prisma.poste.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateStatut : introuvable → NotFoundException', async () => {
    prisma.poste.findUnique.mockResolvedValue(null);
    await expect(service.updateStatut('missing', { statut: StatutPoste.HORS_SERVICE }, acteurId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updateStatut : passage à DISPONIBLE horodate dateDerniereMaintenance', async () => {
    await service.updateStatut('poste-1', { statut: StatutPoste.DISPONIBLE }, acteurId);
    expect(prisma.poste.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statut: StatutPoste.DISPONIBLE, dateDerniereMaintenance: expect.any(Date) }),
      }),
    );
  });

  it('updateStatut : passage à HORS_SERVICE ne touche pas dateDerniereMaintenance', async () => {
    await service.updateStatut('poste-1', { statut: StatutPoste.HORS_SERVICE }, acteurId);
    expect(prisma.poste.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statut: StatutPoste.HORS_SERVICE, dateDerniereMaintenance: null }),
      }),
    );
  });

  it('disponibiliteParSalle : agrège correctement par salle', async () => {
    const result = await service.disponibiliteParSalle();
    expect(result).toEqual([
      { salle: 'Salle A', total: 4, disponibles: 3, horsService: 1 },
      { salle: 'Salle B', total: 2, disponibles: 2, horsService: 0 },
    ]);
  });

  // ── Audit métier (BACK-01, lot 6) ──────────────────────────────────────────

  describe('audit métier', () => {
    it('create : CREATE sur le poste, attribué à l\'acteur', async () => {
      prisma.poste.create.mockResolvedValue({ id: 'poste-1', salle: 'S1', statut: 'DISPONIBLE' });

      await service.create({ salle: 'S1' } as never, acteurId);

      const e = dernierAudit();
      expect(e.action).toBe('CREATE');
      expect(e.entity).toBe('Poste');
      expect(e.entityId).toBe('poste-1');
      expect(e.actorId).toBe(acteurId);
    });

    it('updateStatut : UPDATE décrivant la transition avant → après', async () => {
      prisma.poste.findUnique.mockResolvedValue({ id: 'poste-1', statut: 'EN_PANNE', salle: 'S1' });
      prisma.poste.update.mockResolvedValue({ id: 'poste-1', statut: 'DISPONIBLE', salle: 'S1' });

      await service.updateStatut('poste-1', { statut: 'DISPONIBLE' } as never, acteurId);

      const e = dernierAudit();
      expect(e.action).toBe('UPDATE');
      expect(e.entityId).toBe('poste-1');
      // La transition est le fait métier : les deux statuts sont journalisés.
      expect(e.details).toMatchObject({ statutAvant: 'EN_PANNE', statutApres: 'DISPONIBLE' });
    });

    it('l\'audit passe par le client de la transaction', async () => {
      prisma.poste.create.mockResolvedValue({ id: 'poste-1', salle: 'S1', statut: 'DISPONIBLE' });

      await service.create({ salle: 'S1' } as never, acteurId);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(clientDuDernierAudit()).toBe(prisma);
    });

    it('un poste introuvable n\'écrit aucun audit', async () => {
      prisma.poste.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatut('absent', { statut: 'DISPONIBLE' } as never, acteurId),
      ).rejects.toBeDefined();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });
});
