import { PrismaClient } from '@prisma/client';
import { createTestPrisma, truncateAll } from '../test/prisma-test-client';
import { TEST_PERMISSIONS } from '../prisma/seed';

/**
 * Vérifie, contre une vraie base isseg_test, que le RBAC Support
 * Informatique déclaré dans seed.ts (TEST_PERMISSIONS) persiste
 * correctement : TECHNICIEN ↔ TRAITER_REQUETES_SUPPORT_IT et
 * RESPONSABLE_IT ↔ MANAGE_SUPPORT_IT, sans réattribution croisée.
 * Reproduit exactement la séquence d'upsert de seed.ts (Role → Permission
 * → RolePermission) plutôt que d'appeler main() (qui exige ADMIN_EMAIL/
 * ADMIN_PASSWORD et écrit des données de démo hors périmètre RBAC).
 */
let prisma: PrismaClient;

beforeAll(() => {
  prisma = createTestPrisma();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await truncateAll(prisma);
});

describe('RBAC Support Informatique — persistance réelle sur isseg_test', () => {
  it('TECHNICIEN et RESPONSABLE_IT reçoivent chacun exactement la bonne permission', async () => {
    const roleByName: Record<string, { id: string }> = {};
    for (const nomRole of ['TECHNICIEN', 'RESPONSABLE_IT']) {
      roleByName[nomRole] = await prisma.role.upsert({
        where: { nomRole },
        update: {},
        create: { nomRole },
      });
    }

    const supportItPermissions = TEST_PERMISSIONS.filter((p) =>
      ['MANAGE_SUPPORT_IT', 'TRAITER_REQUETES_SUPPORT_IT'].includes(p.nomPermission),
    );
    expect(supportItPermissions).toHaveLength(2);

    for (const p of supportItPermissions) {
      const permission = await prisma.permission.upsert({
        where: { nomPermission: p.nomPermission },
        update: { description: p.description },
        create: { nomPermission: p.nomPermission, description: p.description },
      });
      for (const roleName of p.roles) {
        await prisma.rolePermission.create({
          data: { roleId: roleByName[roleName].id, permissionId: permission.id },
        });
      }
    }

    const technicienPermissions = await prisma.rolePermission.findMany({
      where: { roleId: roleByName.TECHNICIEN.id },
      include: { permission: true },
    });
    const responsableItPermissions = await prisma.rolePermission.findMany({
      where: { roleId: roleByName.RESPONSABLE_IT.id },
      include: { permission: true },
    });

    expect(technicienPermissions.map((rp) => rp.permission.nomPermission)).toEqual([
      'TRAITER_REQUETES_SUPPORT_IT',
    ]);
    expect(responsableItPermissions.map((rp) => rp.permission.nomPermission)).toEqual([
      'MANAGE_SUPPORT_IT',
    ]);
  });

  it("réattribuer la même permission au même rôle est rejeté par la contrainte d'unicité (idempotence attendue via find-then-create, pas via un doublon silencieux)", async () => {
    const role = await prisma.role.create({ data: { nomRole: 'TECHNICIEN' } });
    const permission = await prisma.permission.create({
      data: { nomPermission: 'TRAITER_REQUETES_SUPPORT_IT', description: 'test' },
    });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });

    await expect(
      prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } }),
    ).rejects.toThrow();
  });
});
