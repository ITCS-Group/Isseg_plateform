import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

interface PrismaMock {
  utilisateur: {
    findMany: jest.Mock;
    count: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  utilisateurRole: {
    findUnique: jest.Mock;
    upsert: jest.Mock;
    delete: jest.Mock;
  };
  role: {
    findUnique: jest.Mock;
  };
  refreshToken: {
    updateMany: jest.Mock;
  };
  /** Transaction interactive : exécute le callback avec le mock lui-même comme `tx`. */
  $transaction: jest.Mock;
}

const USER = {
  id: 'user-1',
  nom: 'Diallo',
  prenom: 'Abdourahmane',
  email: 'a.diallo@isseg.edu',
  estActif: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  roles: [{ role: { id: 'role-1', nomRole: 'SCOLARITE' } }],
};

const ROLE = { id: 'role-1', nomRole: 'SCOLARITE' };

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      utilisateur: {
        findMany: jest.fn().mockResolvedValue([USER]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(USER),
        create: jest.fn().mockResolvedValue(USER),
        update: jest.fn().mockResolvedValue(USER),
      },
      utilisateurRole: {
        findUnique: jest.fn().mockResolvedValue({ utilisateurId: 'user-1', roleId: 'role-1' }),
        upsert: jest.fn().mockResolvedValue({ utilisateurId: 'user-1', roleId: 'role-1' }),
        delete: jest.fn().mockResolvedValue({ utilisateurId: 'user-1', roleId: 'role-1' }),
      },
      role: {
        findUnique: jest.fn().mockResolvedValue(ROLE),
      },
      refreshToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    service = new UsersService(prisma as never);
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  it('findAll : pagine avec skip/take et renvoie une meta cohérente', async () => {
    prisma.utilisateur.count.mockResolvedValue(42);

    const result = await service.findAll({ page: 3, limit: 10 });

    expect(prisma.utilisateur.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10, orderBy: { createdAt: 'desc' } }),
    );
    expect(result.meta).toEqual({ total: 42, page: 3, limit: 10, totalPages: 5 });
  });

  it('findAll : totalPages vaut 0 quand aucun utilisateur ne correspond', async () => {
    prisma.utilisateur.count.mockResolvedValue(0);
    prisma.utilisateur.findMany.mockResolvedValue([]);

    const result = await service.findAll({ page: 1, limit: 20 });

    expect(result.data).toEqual([]);
    expect(result.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 0 });
  });

  it('findAll : filtre nom → recherche insensible à la casse sur nom OU prénom', async () => {
    await service.findAll({ page: 1, limit: 20, nom: 'diallo' });

    expect(prisma.utilisateur.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { nom: { contains: 'diallo', mode: 'insensitive' } },
            { prenom: { contains: 'diallo', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });

  it('findAll : filtres estActif et roleId sont propagés dans le where', async () => {
    await service.findAll({ page: 1, limit: 20, estActif: false, roleId: 'role-9' });

    expect(prisma.utilisateur.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { estActif: false, roles: { some: { roleId: 'role-9' } } },
      }),
    );
  });

  it('findAll : le DTO n\'expose jamais le hash du mot de passe', async () => {
    const result = await service.findAll({ page: 1, limit: 20 });

    expect(result.data[0]).not.toHaveProperty('motDePasseHash');
    expect(result.data[0].roles).toEqual([{ id: 'role-1', nomRole: 'SCOLARITE' }]);
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  it('findOne : renvoie le DTO aplati de l\'utilisateur', async () => {
    const result = await service.findOne('user-1');

    expect(result.id).toBe('user-1');
    expect(result.roles).toEqual([{ id: 'role-1', nomRole: 'SCOLARITE' }]);
  });

  it('findOne : introuvable → NotFoundException', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  // ── create ────────────────────────────────────────────────────────────────

  it('create : hache le mot de passe avec bcrypt et ne le stocke jamais en clair', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue(null);

    await service.create({
      nom: 'Diallo',
      prenom: 'Abdourahmane',
      email: 'a.diallo@isseg.edu',
      motDePasse: 'MotDePasse123!',
    });

    const data = prisma.utilisateur.create.mock.calls[0][0].data;
    expect(data.motDePasseHash).toMatch(/^\$2[aby]\$12\$/);
    expect(data.motDePasseHash).not.toBe('MotDePasse123!');
    expect(data).not.toHaveProperty('motDePasse');
  });

  it('create : attribue les rôles fournis via roleIds', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue(null);

    await service.create({
      nom: 'Diallo',
      prenom: 'Abdourahmane',
      email: 'a.diallo@isseg.edu',
      motDePasse: 'MotDePasse123!',
      roleIds: ['role-1', 'role-2'],
    });

    expect(prisma.utilisateur.create.mock.calls[0][0].data.roles).toEqual({
      create: [{ roleId: 'role-1' }, { roleId: 'role-2' }],
    });
  });

  it('create : e-mail déjà utilisé → ConflictException', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({ id: 'autre', email: 'a.diallo@isseg.edu' });

    await expect(
      service.create({
        nom: 'Diallo',
        prenom: 'Abdourahmane',
        email: 'a.diallo@isseg.edu',
        motDePasse: 'MotDePasse123!',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.utilisateur.create).not.toHaveBeenCalled();
  });

  // ── update ────────────────────────────────────────────────────────────────

  it('update : applique les champs fournis', async () => {
    await service.update('user-1', { nom: 'Barry' });

    expect(prisma.utilisateur.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' }, data: { nom: 'Barry' } }),
    );
  });

  it('update : bascule estActif', async () => {
    prisma.utilisateur.update.mockResolvedValue({ ...USER, estActif: false });

    const result = await service.update('user-1', { estActif: false });

    expect(prisma.utilisateur.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { estActif: false } }),
    );
    expect(result.estActif).toBe(false);
  });

  it('update : introuvable → NotFoundException', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { nom: 'Barry' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('update : e-mail déjà pris par un autre utilisateur → ConflictException', async () => {
    prisma.utilisateur.findUnique
      .mockResolvedValueOnce(USER) // findRowOrThrow
      .mockResolvedValueOnce({ id: 'autre', email: 'pris@isseg.edu' }); // assertEmailFree

    await expect(service.update('user-1', { email: 'pris@isseg.edu' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.utilisateur.update).not.toHaveBeenCalled();
  });

  it('update : conserver son propre e-mail ne déclenche pas de conflit', async () => {
    prisma.utilisateur.findUnique
      .mockResolvedValueOnce(USER) // findRowOrThrow
      .mockResolvedValueOnce(USER); // assertEmailFree → même id

    await expect(
      service.update('user-1', { email: 'a.diallo@isseg.edu' }),
    ).resolves.toBeDefined();
    expect(prisma.utilisateur.update).toHaveBeenCalled();
  });

  // ── remove (soft delete) ──────────────────────────────────────────────────

  it('remove : désactive le compte au lieu de le supprimer', async () => {
    await service.remove('user-1');

    expect(prisma.utilisateur.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { estActif: false },
    });
  });

  it('remove : introuvable → NotFoundException', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue(null);

    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.utilisateur.update).not.toHaveBeenCalled();
  });

  it('remove : révoque les refresh tokens actifs de l\'utilisateur', async () => {
    await service.remove('user-1');

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { utilisateurId: 'user-1', isRevoked: false },
      data: { isRevoked: true },
    });
  });

  // ── changePassword ────────────────────────────────────────────────────────

  it('changePassword : écrit un hash bcrypt, jamais le mot de passe en clair', async () => {
    await service.changePassword('user-1', { nouveauMotDePasse: 'NouveauPass123!' });

    const call = prisma.utilisateur.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'user-1' });
    expect(call.data.motDePasseHash).toMatch(/^\$2[aby]\$12\$/);
    expect(call.data.motDePasseHash).not.toBe('NouveauPass123!');
  });

  it('changePassword : introuvable → NotFoundException', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue(null);

    await expect(
      service.changePassword('missing', { nouveauMotDePasse: 'NouveauPass123!' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.utilisateur.update).not.toHaveBeenCalled();
  });

  it('changePassword : révoque les sessions actives de l\'utilisateur', async () => {
    await service.changePassword('user-1', { nouveauMotDePasse: 'NouveauPass123!' });

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { utilisateurId: 'user-1', isRevoked: false },
      data: { isRevoked: true },
    });
  });

  // ── assignRole / removeRole ───────────────────────────────────────────────

  it('assignRole : upsert idempotent sur la table de liaison', async () => {
    await service.assignRole('user-1', 'role-1');

    expect(prisma.utilisateurRole.upsert).toHaveBeenCalledWith({
      where: { utilisateurId_roleId: { utilisateurId: 'user-1', roleId: 'role-1' } },
      create: { utilisateurId: 'user-1', roleId: 'role-1' },
      update: {},
    });
  });

  it('assignRole : utilisateur introuvable → NotFoundException', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue(null);

    await expect(service.assignRole('missing', 'role-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.utilisateurRole.upsert).not.toHaveBeenCalled();
  });

  it('assignRole : rôle introuvable → NotFoundException', async () => {
    prisma.role.findUnique.mockResolvedValue(null);

    await expect(service.assignRole('user-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.utilisateurRole.upsert).not.toHaveBeenCalled();
  });

  it('removeRole : supprime la liaison existante', async () => {
    await service.removeRole('user-1', 'role-1');

    expect(prisma.utilisateurRole.delete).toHaveBeenCalledWith({
      where: { utilisateurId_roleId: { utilisateurId: 'user-1', roleId: 'role-1' } },
    });
  });

  it('removeRole : rôle non attribué → NotFoundException', async () => {
    prisma.utilisateurRole.findUnique.mockResolvedValue(null);

    await expect(service.removeRole('user-1', 'role-9')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.utilisateurRole.delete).not.toHaveBeenCalled();
  });

  it('removeRole : utilisateur introuvable → NotFoundException', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue(null);

    await expect(service.removeRole('missing', 'role-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.utilisateurRole.delete).not.toHaveBeenCalled();
  });
});
