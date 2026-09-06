import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createTestPrisma, truncateAll } from '../../../test/prisma-test-client';
import { PermissionsService } from './permissions.service';

let prisma: PrismaClient;
let service: PermissionsService;

const UUID_INEXISTANT = '00000000-0000-0000-0000-000000000000';

async function creerRole(nomRole: string) {
  return prisma.role.create({ data: { nomRole } });
}

beforeAll(() => {
  prisma = createTestPrisma(); // garde-fou : refuse si != isseg_test
  service = new PermissionsService(prisma as never);
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await truncateAll(prisma);
});

describe('Intégration — PermissionsService (isseg_test)', () => {
  // ── CRUD ────────────────────────────────────────────────────────────────

  it('create + findOne + findAll : cycle de lecture complet', async () => {
    const created = await service.create({
      nomPermission: 'READ_PEDAGOGIE',
      description: 'Lecture des données pédagogiques',
    });
    expect(created.description).toBe('Lecture des données pédagogiques');

    const found = await service.findOne(created.id);
    expect(found.nomPermission).toBe('READ_PEDAGOGIE');

    const all = await service.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(created.id);
  });

  it('create : la description est optionnelle et vaut null par défaut', async () => {
    const created = await service.create({ nomPermission: 'READ_PEDAGOGIE' });

    expect(created.description).toBeNull();
  });

  it('findAll : trie les permissions par nom croissant', async () => {
    await service.create({ nomPermission: 'READ_PEDAGOGIE' });
    await service.create({ nomPermission: 'MANAGE_PEDAGOGIE' });
    await service.create({ nomPermission: 'MANAGE_DOSSIER_INSCRIPTION' });

    const all = await service.findAll();

    expect(all.map((p) => p.nomPermission)).toEqual([
      'MANAGE_DOSSIER_INSCRIPTION',
      'MANAGE_PEDAGOGIE',
      'READ_PEDAGOGIE',
    ]);
  });

  it('create : nom de permission déjà existant → ConflictException', async () => {
    await service.create({ nomPermission: 'READ_PEDAGOGIE' });

    await expect(service.create({ nomPermission: 'READ_PEDAGOGIE' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(await prisma.permission.count()).toBe(1);
  });

  it('findOne : identifiant inconnu → NotFoundException', async () => {
    await expect(service.findOne(UUID_INEXISTANT)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update : modifie la description seule', async () => {
    const created = await service.create({
      nomPermission: 'READ_PEDAGOGIE',
      description: 'Ancienne',
    });

    const updated = await service.update(created.id, { description: 'Nouvelle' });

    expect(updated.description).toBe('Nouvelle');
    expect(updated.nomPermission).toBe('READ_PEDAGOGIE');
  });

  it('update : renomme la permission', async () => {
    const created = await service.create({ nomPermission: 'READ_PEDAGOGIE' });

    const updated = await service.update(created.id, { nomPermission: 'MANAGE_PEDAGOGIE' });

    expect(updated.nomPermission).toBe('MANAGE_PEDAGOGIE');
    expect(updated.id).toBe(created.id);
  });

  it('update : nom déjà porté par une autre permission → ConflictException', async () => {
    const premiere = await service.create({ nomPermission: 'READ_PEDAGOGIE' });
    await service.create({ nomPermission: 'MANAGE_PEDAGOGIE' });

    await expect(
      service.update(premiere.id, { nomPermission: 'MANAGE_PEDAGOGIE' }),
    ).rejects.toBeInstanceOf(ConflictException);

    const inchangee = await service.findOne(premiere.id);
    expect(inchangee.nomPermission).toBe('READ_PEDAGOGIE');
  });

  it('update : identifiant inconnu → NotFoundException', async () => {
    await expect(
      service.update(UUID_INEXISTANT, { description: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove : supprime définitivement une permission non rattachée', async () => {
    const created = await service.create({ nomPermission: 'READ_PEDAGOGIE' });

    await service.remove(created.id);

    expect(await prisma.permission.count()).toBe(0);
    await expect(service.findOne(created.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove : permission encore rattachée à un rôle → ConflictException', async () => {
    const perm = await service.create({ nomPermission: 'READ_PEDAGOGIE' });
    const role = await creerRole('ENSEIGNANT');
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: perm.id },
    });

    await expect(service.remove(perm.id)).rejects.toBeInstanceOf(ConflictException);
    expect(await prisma.permission.count()).toBe(1);
  });

  it('remove : redevient possible une fois la permission détachée du dernier rôle', async () => {
    const perm = await service.create({ nomPermission: 'READ_PEDAGOGIE' });
    const role = await creerRole('ENSEIGNANT');
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: perm.id },
    });

    await expect(service.remove(perm.id)).rejects.toBeInstanceOf(ConflictException);

    await prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
    });

    await service.remove(perm.id);
    expect(await prisma.permission.count()).toBe(0);
  });

  it('remove : identifiant inconnu → NotFoundException', async () => {
    await expect(service.remove(UUID_INEXISTANT)).rejects.toBeInstanceOf(NotFoundException);
  });
});
