import { ConflictException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { RolesService } from './roles.service';

interface PrismaMock {
  role: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  permission: {
    findUnique: jest.Mock;
  };
  rolePermission: {
    findUnique: jest.Mock;
    upsert: jest.Mock;
    delete: jest.Mock;
  };
  utilisateurRole: {
    count: jest.Mock;
  };
  auditLog: {
    create: jest.Mock;
  };
  /** Transaction interactive : exécute le callback avec le mock lui-même comme `tx`. */
  $transaction: jest.Mock;
}

const PERMISSION = {
  id: 'perm-1',
  nomPermission: 'READ_PEDAGOGIE',
  description: 'Lecture pédagogie',
};

const ROLE = {
  id: 'role-1',
  nomRole: 'SCOLARITE',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  permissions: [{ permission: PERMISSION }],
};

/** Pagination par défaut (cf. PaginationDto) — évite de la répéter dans chaque appel. */
const PAGE_DEFAUT = { page: 1, limit: 20 };

/** Acteur des mutations. Prisma est mocké ici : aucune contrainte de clé
 *  étrangère, une valeur constante suffit. */
const acteurId = 'acteur-1';

describe('RolesService', () => {
  let service: RolesService;
  let audit: AuditService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      role: {
        findMany: jest.fn().mockResolvedValue([ROLE]),
        findUnique: jest.fn().mockResolvedValue(ROLE),
        create: jest.fn().mockResolvedValue(ROLE),
        update: jest.fn().mockResolvedValue(ROLE),
        delete: jest.fn().mockResolvedValue(ROLE),
        count: jest.fn().mockResolvedValue(1),
      },
      permission: {
        findUnique: jest.fn().mockResolvedValue(PERMISSION),
      },
      rolePermission: {
        // `permission` est inclus : removePermission capture le nom AVANT
        // de supprimer la liaison, pour ne pas relire une ligne effacée.
        findUnique: jest.fn().mockResolvedValue({ roleId: 'role-1', permissionId: 'perm-1', permission: { nomPermission: 'READ_PEDAGOGIE' } }),
        upsert: jest.fn().mockResolvedValue({ roleId: 'role-1', permissionId: 'perm-1' }),
        delete: jest.fn().mockResolvedValue({ roleId: 'role-1', permissionId: 'perm-1' }),
      },
      utilisateurRole: {
        count: jest.fn().mockResolvedValue(0),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    audit = new AuditService();
    jest.spyOn(audit, 'record');
    service = new RolesService(prisma as never, audit);
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

  // ── Lecture ───────────────────────────────────────────────────────────────

  it('findAll : trie par nomRole et aplatit les permissions', async () => {
    const result = await service.findAll({ ...PAGE_DEFAUT });

    expect(prisma.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { nomRole: 'asc' } }),
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0].permissions).toEqual([PERMISSION]);
  });

  // ── Pagination (BACK-02-B1) ───────────────────────────────────────────────

  it('findAll : page par défaut → {data, meta} avec skip=0/take=20', async () => {
    prisma.role.count.mockResolvedValue(1);

    const result = await service.findAll({ ...PAGE_DEFAUT });

    expect(prisma.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
    expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
  });

  it('findAll : meta.total vient d’un count recevant le même where que findMany', async () => {
    prisma.role.count.mockResolvedValue(42);

    const result = await service.findAll({ ...PAGE_DEFAUT });

    const whereFindMany = prisma.role.findMany.mock.calls[0][0].where;
    expect(prisma.role.count).toHaveBeenCalledWith({ where: whereFindMany });
    expect(result.meta.total).toBe(42);
  });

  it('findAll : dernière page partielle → skip/take corrects, totalPages arrondi au supérieur', async () => {
    prisma.role.count.mockResolvedValue(41);

    const result = await service.findAll({ page: 3, limit: 20 });

    expect(prisma.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 }),
    );
    expect(result.meta).toEqual({ total: 41, page: 3, limit: 20, totalPages: 3 });
  });

  it('findAll : collection vide → totalPages plancher à 1', async () => {
    prisma.role.findMany.mockResolvedValue([]);
    prisma.role.count.mockResolvedValue(0);

    const result = await service.findAll({ ...PAGE_DEFAUT });

    expect(result.data).toEqual([]);
    expect(result.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 1 });
  });

  it('findAll : limit personnalisé → skip/take et totalPages cohérents', async () => {
    prisma.role.count.mockResolvedValue(7);

    const result = await service.findAll({ page: 2, limit: 5 });

    expect(prisma.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
    expect(result.meta).toEqual({ total: 7, page: 2, limit: 5, totalPages: 2 });
  });

  it('findOne : renvoie le DTO du rôle', async () => {
    const result = await service.findOne('role-1');

    expect(result.nomRole).toBe('SCOLARITE');
  });

  it('findOne : introuvable → NotFoundException', async () => {
    prisma.role.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  // ── Création ──────────────────────────────────────────────────────────────

  it('create : crée le rôle quand le nom est libre', async () => {
    prisma.role.findUnique.mockResolvedValue(null);

    const result = await service.create({ nomRole: 'SCOLARITE' }, acteurId);

    expect(prisma.role.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nomRole: 'SCOLARITE' }) }),
    );
    expect(result.id).toBe('role-1');
  });

  it('create : rattache les permissions fournies via permissionIds', async () => {
    prisma.role.findUnique.mockResolvedValue(null);

    await service.create({ nomRole: 'SCOLARITE', permissionIds: ['perm-1', 'perm-2'] }, acteurId);

    expect(prisma.role.create.mock.calls[0][0].data.permissions).toEqual({
      create: [{ permissionId: 'perm-1' }, { permissionId: 'perm-2' }],
    });
  });

  it('create : nom de rôle déjà pris → ConflictException', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'autre', nomRole: 'SCOLARITE' });

    await expect(service.create({ nomRole: 'SCOLARITE' }, acteurId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.role.create).not.toHaveBeenCalled();
  });

  // ── Mise à jour ───────────────────────────────────────────────────────────

  it('update : renomme le rôle', async () => {
    prisma.role.findUnique
      .mockResolvedValueOnce(ROLE) // findRowOrThrow
      .mockResolvedValueOnce(null); // assertNameFree

    await service.update('role-1', { nomRole: 'SCOLARITE_SENIOR' }, acteurId);

    expect(prisma.role.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'role-1' },
        data: { nomRole: 'SCOLARITE_SENIOR' },
      }),
    );
  });

  it('update : introuvable → NotFoundException', async () => {
    prisma.role.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { nomRole: 'AUTRE' }, acteurId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.role.update).not.toHaveBeenCalled();
  });

  it('update : nom déjà porté par un autre rôle → ConflictException', async () => {
    prisma.role.findUnique
      .mockResolvedValueOnce(ROLE) // findRowOrThrow
      .mockResolvedValueOnce({ id: 'autre', nomRole: 'ENSEIGNANT' }); // assertNameFree

    await expect(service.update('role-1', { nomRole: 'ENSEIGNANT' }, acteurId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.role.update).not.toHaveBeenCalled();
  });

  it('update : conserver son propre nom ne déclenche pas de conflit', async () => {
    prisma.role.findUnique
      .mockResolvedValueOnce(ROLE) // findRowOrThrow
      .mockResolvedValueOnce(ROLE); // assertNameFree → même id

    await expect(service.update('role-1', { nomRole: 'SCOLARITE' }, acteurId)).resolves.toBeDefined();
    expect(prisma.role.update).toHaveBeenCalled();
  });

  // ── Suppression ───────────────────────────────────────────────────────────

  it('remove : supprime un rôle non attribué', async () => {
    await service.remove('role-1', acteurId);

    expect(prisma.role.delete).toHaveBeenCalledWith({ where: { id: 'role-1' } });
  });

  it('remove : rôle encore attribué à des utilisateurs → ConflictException', async () => {
    prisma.utilisateurRole.count.mockResolvedValue(3);

    await expect(service.remove('role-1', acteurId)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.role.delete).not.toHaveBeenCalled();
  });

  it('remove : introuvable → NotFoundException', async () => {
    prisma.role.findUnique.mockResolvedValue(null);

    await expect(service.remove('missing', acteurId)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.role.delete).not.toHaveBeenCalled();
  });

  // ── Permissions ───────────────────────────────────────────────────────────

  it('assignPermission : upsert idempotent sur la table de liaison', async () => {
    await service.assignPermission('role-1', 'perm-1', acteurId);

    expect(prisma.rolePermission.upsert).toHaveBeenCalledWith({
      where: { roleId_permissionId: { roleId: 'role-1', permissionId: 'perm-1' } },
      create: { roleId: 'role-1', permissionId: 'perm-1' },
      update: {},
    });
  });

  it('assignPermission : rôle introuvable → NotFoundException', async () => {
    prisma.role.findUnique.mockResolvedValue(null);

    await expect(service.assignPermission('missing', 'perm-1', acteurId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.rolePermission.upsert).not.toHaveBeenCalled();
  });

  it('assignPermission : permission introuvable → NotFoundException', async () => {
    prisma.permission.findUnique.mockResolvedValue(null);

    await expect(service.assignPermission('role-1', 'missing', acteurId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.rolePermission.upsert).not.toHaveBeenCalled();
  });

  it('removePermission : supprime la liaison existante', async () => {
    await service.removePermission('role-1', 'perm-1', acteurId);

    expect(prisma.rolePermission.delete).toHaveBeenCalledWith({
      where: { roleId_permissionId: { roleId: 'role-1', permissionId: 'perm-1' } },
    });
  });

  it('removePermission : permission non attribuée au rôle → NotFoundException', async () => {
    prisma.rolePermission.findUnique.mockResolvedValue(null);

    await expect(service.removePermission('role-1', 'perm-9', acteurId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.rolePermission.delete).not.toHaveBeenCalled();
  });

  // ── Audit métier (BACK-01, lot 2) ──────────────────────────────────────────

  describe('audit métier', () => {
    it('create : CREATE sur le rôle créé, attribué à l\'acteur', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      await service.create({ nomRole: 'NOUVEAU' } as never, acteurId);

      const e = dernierAudit();
      expect(e.action).toBe('CREATE');
      expect(e.entity).toBe('Role');
      expect(e.actorId).toBe(acteurId);
      expect(e.actorId).not.toBe(e.entityId);
    });

    it('update : UPDATE, seuls les noms des champs modifiés', async () => {
      await service.update('role-1', { nomRole: 'RENOMME' } as never, acteurId);

      const e = dernierAudit();
      expect(e.action).toBe('UPDATE');
      expect(e.entity).toBe('Role');
      expect(e.entityId).toBe('role-1');
      expect(e.details).toEqual({ champsModifies: ['nomRole'] });
    });

    it('remove : DELETE conservant le nom capturé avant suppression', async () => {
      prisma.utilisateurRole.count.mockResolvedValue(0);
      await service.remove('role-1', acteurId);

      const e = dernierAudit();
      expect(e.action).toBe('DELETE');
      expect(e.entityId).toBe('role-1');
      expect(e.details).toMatchObject({ nomRole: expect.any(String) });
    });

    it('assignPermission : CREATE sur le RÔLE, la permission restant un détail', async () => {
      await service.assignPermission('role-1', 'perm-1', acteurId);

      const e = dernierAudit();
      expect(e.action).toBe('CREATE');
      expect(e.entity).toBe('Role');
      expect(e.entityId).toBe('role-1');
      expect(e.details).toMatchObject({ permissionId: 'perm-1' });
    });

    it('removePermission : DELETE sur le rôle', async () => {
      await service.removePermission('role-1', 'perm-1', acteurId);

      const e = dernierAudit();
      expect(e.action).toBe('DELETE');
      expect(e.entity).toBe('Role');
      expect(e.entityId).toBe('role-1');
    });

    it('l\'audit passe par le client de la transaction', async () => {
      prisma.utilisateurRole.count.mockResolvedValue(0);
      await service.remove('role-1', acteurId);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(clientDuDernierAudit()).toBe(prisma);
    });

    it('une mutation en échec n\'écrit aucun audit', async () => {
      prisma.role.update.mockRejectedValueOnce(new Error('contrainte violée'));

      await expect(
        service.update('role-1', { nomRole: 'X' } as never, acteurId),
      ).rejects.toThrow('contrainte violée');
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('un refus métier avant la transaction n\'écrit aucun audit', async () => {
      prisma.utilisateurRole.count.mockResolvedValue(3);

      await expect(service.remove('role-1', acteurId)).rejects.toBeDefined();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });
});
