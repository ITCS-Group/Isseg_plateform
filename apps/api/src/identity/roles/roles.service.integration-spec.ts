import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createTestPrisma, truncateAll } from '../../../test/prisma-test-client';
import { RolesService } from './roles.service';

let prisma: PrismaClient;
let service: RolesService;

const UUID_INEXISTANT = '00000000-0000-0000-0000-000000000000';

/** Pagination par défaut (cf. PaginationDto) — page 1, 20 éléments. */
const PAGE_DEFAUT = { page: 1, limit: 20 };

async function creerPermission(nomPermission: string, description?: string) {
  return prisma.permission.create({ data: { nomPermission, description } });
}

async function creerUtilisateur(email: string) {
  return prisma.utilisateur.create({
    data: {
      nom: 'Test',
      prenom: 'Role',
      email,
      motDePasseHash: await bcrypt.hash('ChangeMe123!', 4),
    },
  });
}

beforeAll(() => {
  prisma = createTestPrisma(); // garde-fou : refuse si != isseg_test
  service = new RolesService(prisma as never);
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await truncateAll(prisma);
});

describe('Intégration — RolesService (isseg_test)', () => {
  // ── CRUD ────────────────────────────────────────────────────────────────

  it('create + findOne + findAll : cycle de lecture complet', async () => {
    const created = await service.create({ nomRole: 'SCOLARITE' });
    expect(created.permissions).toEqual([]);

    const found = await service.findOne(created.id);
    expect(found.nomRole).toBe('SCOLARITE');

    const all = await service.findAll({ ...PAGE_DEFAUT });
    expect(all.data).toHaveLength(1);
    expect(all.data[0].id).toBe(created.id);
    expect(all.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
  });

  it('findAll : trie les rôles par nom croissant', async () => {
    await service.create({ nomRole: 'SCOLARITE' });
    await service.create({ nomRole: 'ENSEIGNANT' });
    await service.create({ nomRole: 'DGA_ETUDES' });

    const all = await service.findAll({ ...PAGE_DEFAUT });

    expect(all.data.map((r) => r.nomRole)).toEqual(['DGA_ETUDES', 'ENSEIGNANT', 'SCOLARITE']);
  });

  // ── Pagination (BACK-02-B1) ─────────────────────────────────────────────

  it('findAll : page par défaut, meta cohérent avec le nombre réel de rôles', async () => {
    await service.create({ nomRole: 'SCOLARITE' });
    await service.create({ nomRole: 'ENSEIGNANT' });
    await service.create({ nomRole: 'DGA_ETUDES' });

    const result = await service.findAll({ ...PAGE_DEFAUT });

    expect(result.data).toHaveLength(3);
    expect(result.meta).toEqual({ total: 3, page: 1, limit: 20, totalPages: 1 });
  });

  it('findAll : dernière page partielle, totalPages arrondi au supérieur', async () => {
    for (const nomRole of ['A_ROLE', 'B_ROLE', 'C_ROLE', 'D_ROLE', 'E_ROLE']) {
      await service.create({ nomRole });
    }

    const page3 = await service.findAll({ page: 3, limit: 2 });

    expect(page3.data).toHaveLength(1);
    expect(page3.data[0].nomRole).toBe('E_ROLE');
    expect(page3.meta).toEqual({ total: 5, page: 3, limit: 2, totalPages: 3 });
  });

  it('findAll : collection vide → data vide et totalPages plancher à 1', async () => {
    const result = await service.findAll({ ...PAGE_DEFAUT });

    expect(result.data).toEqual([]);
    expect(result.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 1 });
  });

  it('findAll : page au-delà du dernier index → data vide, meta.total inchangé', async () => {
    await service.create({ nomRole: 'SCOLARITE' });

    const result = await service.findAll({ page: 5, limit: 20 });

    expect(result.data).toEqual([]);
    expect(result.meta).toEqual({ total: 1, page: 5, limit: 20, totalPages: 1 });
  });

  it('create : rattache les permissions passées dans permissionIds', async () => {
    const perm = await creerPermission('READ_PEDAGOGIE', 'Lecture pédagogie');

    const created = await service.create({
      nomRole: 'ENSEIGNANT',
      permissionIds: [perm.id],
    });

    expect(created.permissions).toEqual([
      { id: perm.id, nomPermission: 'READ_PEDAGOGIE', description: 'Lecture pédagogie' },
    ]);
  });

  it('create : nom de rôle déjà existant → ConflictException', async () => {
    await service.create({ nomRole: 'SCOLARITE' });

    await expect(service.create({ nomRole: 'SCOLARITE' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(await prisma.role.count()).toBe(1);
  });

  it('findOne : identifiant inconnu → NotFoundException', async () => {
    await expect(service.findOne(UUID_INEXISTANT)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update : renomme le rôle', async () => {
    const created = await service.create({ nomRole: 'SCOLARITE' });

    const updated = await service.update(created.id, { nomRole: 'SCOLARITE_SENIOR' });

    expect(updated.nomRole).toBe('SCOLARITE_SENIOR');
    expect(updated.id).toBe(created.id);
  });

  it('update : nom déjà porté par un autre rôle → ConflictException', async () => {
    const premier = await service.create({ nomRole: 'SCOLARITE' });
    await service.create({ nomRole: 'ENSEIGNANT' });

    await expect(
      service.update(premier.id, { nomRole: 'ENSEIGNANT' }),
    ).rejects.toBeInstanceOf(ConflictException);

    const inchange = await service.findOne(premier.id);
    expect(inchange.nomRole).toBe('SCOLARITE');
  });

  it('update : identifiant inconnu → NotFoundException', async () => {
    await expect(
      service.update(UUID_INEXISTANT, { nomRole: 'AUTRE' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove : supprime définitivement un rôle non attribué', async () => {
    const created = await service.create({ nomRole: 'SCOLARITE' });

    await service.remove(created.id);

    expect(await prisma.role.count()).toBe(0);
    await expect(service.findOne(created.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove : rôle encore attribué à un utilisateur → ConflictException', async () => {
    const role = await service.create({ nomRole: 'SCOLARITE' });
    const user = await creerUtilisateur('role-lie@isseg-test.local');
    await prisma.utilisateurRole.create({
      data: { utilisateurId: user.id, roleId: role.id },
    });

    await expect(service.remove(role.id)).rejects.toBeInstanceOf(ConflictException);
    expect(await prisma.role.count()).toBe(1);
  });

  it('remove : redevient possible une fois le rôle retiré du dernier utilisateur', async () => {
    const role = await service.create({ nomRole: 'SCOLARITE' });
    const user = await creerUtilisateur('role-lie@isseg-test.local');
    await prisma.utilisateurRole.create({
      data: { utilisateurId: user.id, roleId: role.id },
    });

    await expect(service.remove(role.id)).rejects.toBeInstanceOf(ConflictException);

    await prisma.utilisateurRole.delete({
      where: { utilisateurId_roleId: { utilisateurId: user.id, roleId: role.id } },
    });

    await service.remove(role.id);
    expect(await prisma.role.count()).toBe(0);
  });

  it('remove : identifiant inconnu → NotFoundException', async () => {
    await expect(service.remove(UUID_INEXISTANT)).rejects.toBeInstanceOf(NotFoundException);
  });

  // ── Permissions ─────────────────────────────────────────────────────────

  it('assignPermission puis removePermission : cycle complet', async () => {
    const role = await service.create({ nomRole: 'SCOLARITE' });
    const perm = await creerPermission('MANAGE_DOSSIER_INSCRIPTION');

    const avec = await service.assignPermission(role.id, perm.id);
    expect(avec.permissions.map((p) => p.nomPermission)).toEqual([
      'MANAGE_DOSSIER_INSCRIPTION',
    ]);

    const sans = await service.removePermission(role.id, perm.id);
    expect(sans.permissions).toEqual([]);
    expect(await prisma.rolePermission.count()).toBe(0);
  });

  it('assignPermission : deux fois la même permission reste idempotent', async () => {
    const role = await service.create({ nomRole: 'SCOLARITE' });
    const perm = await creerPermission('MANAGE_DOSSIER_INSCRIPTION');

    await service.assignPermission(role.id, perm.id);
    const deuxieme = await service.assignPermission(role.id, perm.id);

    expect(deuxieme.permissions).toHaveLength(1);
    expect(await prisma.rolePermission.count()).toBe(1);
  });

  it('assignPermission : permission inexistante → NotFoundException', async () => {
    const role = await service.create({ nomRole: 'SCOLARITE' });

    await expect(
      service.assignPermission(role.id, UUID_INEXISTANT),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('assignPermission : rôle inexistant → NotFoundException', async () => {
    const perm = await creerPermission('MANAGE_DOSSIER_INSCRIPTION');

    await expect(
      service.assignPermission(UUID_INEXISTANT, perm.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removePermission : permission non attribuée au rôle → NotFoundException', async () => {
    const role = await service.create({ nomRole: 'SCOLARITE' });
    const perm = await creerPermission('MANAGE_DOSSIER_INSCRIPTION');

    await expect(service.removePermission(role.id, perm.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
