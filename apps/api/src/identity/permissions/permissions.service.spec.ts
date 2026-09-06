import { ConflictException, NotFoundException } from '@nestjs/common';
import { PermissionsService } from './permissions.service';

interface PrismaMock {
  permission: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  rolePermission: {
    count: jest.Mock;
  };
}

/** Pagination par défaut (cf. PaginationDto) — évite de la répéter dans chaque appel. */
const PAGE_DEFAUT = { page: 1, limit: 20 };

const PERMISSION = {
  id: 'perm-1',
  nomPermission: 'READ_PEDAGOGIE',
  description: 'Lecture des données pédagogiques',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('PermissionsService', () => {
  let service: PermissionsService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      permission: {
        findMany: jest.fn().mockResolvedValue([PERMISSION]),
        findUnique: jest.fn().mockResolvedValue(PERMISSION),
        create: jest.fn().mockResolvedValue(PERMISSION),
        update: jest.fn().mockResolvedValue(PERMISSION),
        delete: jest.fn().mockResolvedValue(PERMISSION),
        count: jest.fn().mockResolvedValue(1),
      },
      rolePermission: {
        count: jest.fn().mockResolvedValue(0),
      },
    };
    service = new PermissionsService(prisma as never);
  });

  // ── Lecture ───────────────────────────────────────────────────────────────

  it('findAll : trie par nomPermission', async () => {
    const result = await service.findAll({ ...PAGE_DEFAUT });

    expect(prisma.permission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { nomPermission: 'asc' } }),
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0].nomPermission).toBe('READ_PEDAGOGIE');
  });

  // ── Pagination (BACK-02-B1) ───────────────────────────────────────────────

  it('findAll : page par défaut → {data, meta} avec skip=0/take=20', async () => {
    prisma.permission.count.mockResolvedValue(1);

    const result = await service.findAll({ ...PAGE_DEFAUT });

    expect(prisma.permission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
    expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
  });

  it('findAll : meta.total vient d’un count recevant le même where que findMany', async () => {
    prisma.permission.count.mockResolvedValue(42);

    const result = await service.findAll({ ...PAGE_DEFAUT });

    const whereFindMany = prisma.permission.findMany.mock.calls[0][0].where;
    expect(prisma.permission.count).toHaveBeenCalledWith({ where: whereFindMany });
    expect(result.meta.total).toBe(42);
  });

  it('findAll : dernière page partielle → skip/take corrects, totalPages arrondi au supérieur', async () => {
    prisma.permission.count.mockResolvedValue(41);

    const result = await service.findAll({ page: 3, limit: 20 });

    expect(prisma.permission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 }),
    );
    expect(result.meta).toEqual({ total: 41, page: 3, limit: 20, totalPages: 3 });
  });

  it('findAll : collection vide → totalPages plancher à 1', async () => {
    prisma.permission.findMany.mockResolvedValue([]);
    prisma.permission.count.mockResolvedValue(0);

    const result = await service.findAll({ ...PAGE_DEFAUT });

    expect(result.data).toEqual([]);
    expect(result.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 1 });
  });

  it('findAll : limit personnalisé → skip/take et totalPages cohérents', async () => {
    prisma.permission.count.mockResolvedValue(7);

    const result = await service.findAll({ page: 2, limit: 5 });

    expect(prisma.permission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
    expect(result.meta).toEqual({ total: 7, page: 2, limit: 5, totalPages: 2 });
  });

  it('findOne : renvoie le DTO de la permission', async () => {
    const result = await service.findOne('perm-1');

    expect(result).toEqual(PERMISSION);
  });

  it('findOne : introuvable → NotFoundException', async () => {
    prisma.permission.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  // ── Création ──────────────────────────────────────────────────────────────

  it('create : crée la permission quand le nom est libre', async () => {
    prisma.permission.findUnique.mockResolvedValue(null);

    const result = await service.create({
      nomPermission: 'READ_PEDAGOGIE',
      description: 'Lecture des données pédagogiques',
    });

    expect(prisma.permission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          nomPermission: 'READ_PEDAGOGIE',
          description: 'Lecture des données pédagogiques',
        },
      }),
    );
    expect(result.id).toBe('perm-1');
  });

  it('create : nom de permission déjà pris → ConflictException', async () => {
    prisma.permission.findUnique.mockResolvedValue({
      id: 'autre',
      nomPermission: 'READ_PEDAGOGIE',
    });

    await expect(service.create({ nomPermission: 'READ_PEDAGOGIE' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.permission.create).not.toHaveBeenCalled();
  });

  // ── Mise à jour ───────────────────────────────────────────────────────────

  it('update : modifie la description sans contrôle de nom', async () => {
    await service.update('perm-1', { description: 'Nouvelle description' });

    expect(prisma.permission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'perm-1' },
        data: { description: 'Nouvelle description' },
      }),
    );
  });

  it('update : renomme la permission quand le nouveau nom est libre', async () => {
    prisma.permission.findUnique
      .mockResolvedValueOnce(PERMISSION) // findRowOrThrow
      .mockResolvedValueOnce(null); // assertNameFree

    await service.update('perm-1', { nomPermission: 'MANAGE_PEDAGOGIE' });

    expect(prisma.permission.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { nomPermission: 'MANAGE_PEDAGOGIE' } }),
    );
  });

  it('update : introuvable → NotFoundException', async () => {
    prisma.permission.findUnique.mockResolvedValue(null);

    await expect(
      service.update('missing', { description: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.permission.update).not.toHaveBeenCalled();
  });

  it('update : nom déjà porté par une autre permission → ConflictException', async () => {
    prisma.permission.findUnique
      .mockResolvedValueOnce(PERMISSION) // findRowOrThrow
      .mockResolvedValueOnce({ id: 'autre', nomPermission: 'MANAGE_PEDAGOGIE' }); // assertNameFree

    await expect(
      service.update('perm-1', { nomPermission: 'MANAGE_PEDAGOGIE' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.permission.update).not.toHaveBeenCalled();
  });

  it('update : conserver son propre nom ne déclenche pas de conflit', async () => {
    prisma.permission.findUnique
      .mockResolvedValueOnce(PERMISSION) // findRowOrThrow
      .mockResolvedValueOnce(PERMISSION); // assertNameFree → même id

    await expect(
      service.update('perm-1', { nomPermission: 'READ_PEDAGOGIE' }),
    ).resolves.toBeDefined();
    expect(prisma.permission.update).toHaveBeenCalled();
  });

  // ── Suppression ───────────────────────────────────────────────────────────

  it('remove : supprime une permission non rattachée', async () => {
    await service.remove('perm-1');

    expect(prisma.permission.delete).toHaveBeenCalledWith({ where: { id: 'perm-1' } });
  });

  it('remove : permission encore rattachée à des rôles → ConflictException', async () => {
    prisma.rolePermission.count.mockResolvedValue(2);

    await expect(service.remove('perm-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.permission.delete).not.toHaveBeenCalled();
  });

  it('remove : introuvable → NotFoundException', async () => {
    prisma.permission.findUnique.mockResolvedValue(null);

    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.permission.delete).not.toHaveBeenCalled();
  });
});
