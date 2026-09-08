import { NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { CoursSupportITService } from './cours.service';

interface PrismaMock {
  coursSupportIT: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock };
  auditLog: { create: jest.Mock };
  /** Transaction interactive : le callback reçoit le mock lui-même. */
  $transaction: jest.Mock;
}

const COURS = {
  id: 'cours-1',
  titre: 'Bureautique niveau 1',
  contenu: 'Word, Excel, PowerPoint',
  niveau: 'Débutant',
  duree: 120,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/** Acteur des mutations. Prisma est mocké : aucune contrainte de clé étrangère. */
const acteurId = 'acteur-1';

describe('CoursSupportITService', () => {
  let service: CoursSupportITService;
  let audit: AuditService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      coursSupportIT: {
        create: jest.fn().mockResolvedValue(COURS),
        findMany: jest.fn().mockResolvedValue([COURS]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(COURS),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    audit = new AuditService();
    jest.spyOn(audit, 'record');
    service = new CoursSupportITService(prisma as never, audit);
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

  it('create : crée le cours', async () => {
    const result = await service.create({
      titre: 'Bureautique niveau 1',
      contenu: 'Word, Excel, PowerPoint',
      niveau: 'Débutant',
      duree: 120,
    }, acteurId);
    expect(result.id).toBe('cours-1');
  });

  it('findAll : retourne la liste paginée', async () => {
    const result = await service.findAll({ page: 1, limit: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
  });

  it('findOne : introuvable → NotFoundException', async () => {
    prisma.coursSupportIT.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  // ── Audit métier (BACK-01, lot 6) ──────────────────────────────────────────

  describe('audit métier', () => {
    it('create : CREATE sur le cours, attribué à l\'acteur', async () => {
      prisma.coursSupportIT.create.mockResolvedValue({ id: 'cours-1', titre: 'Bureautique' });

      await service.create({ titre: 'Bureautique', contenu: 'x' } as never, acteurId);

      const e = dernierAudit();
      expect(e.action).toBe('CREATE');
      expect(e.entity).toBe('CoursSupportIT');
      expect(e.entityId).toBe('cours-1');
      expect(e.actorId).toBe(acteurId);
    });

    it('l\'audit passe par le client de la transaction', async () => {
      prisma.coursSupportIT.create.mockResolvedValue({ id: 'cours-1', titre: 'Bureautique' });

      await service.create({ titre: 'Bureautique', contenu: 'x' } as never, acteurId);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(clientDuDernierAudit()).toBe(prisma);
    });
  });
});
