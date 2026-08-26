import { TEST_ROLES, AUTH_ONLY_ROLES, TEST_PERMISSIONS } from '../prisma/seed';

/**
 * Test unitaire pur (aucune connexion DB) sur les données RBAC déclarées
 * dans seed.ts — vérifie le reclassement RESPONSABLE_IT et l'ajout du
 * rôle TECHNICIEN (chantier feat/support-it-module).
 */
describe('seed.ts — données RBAC Support Informatique', () => {
  it('RESPONSABLE_IT est dans TEST_ROLES (module métier réel désormais)', () => {
    expect(TEST_ROLES.some((r) => r.nomRole === 'RESPONSABLE_IT')).toBe(true);
  });

  it('TECHNICIEN est dans TEST_ROLES', () => {
    expect(TEST_ROLES.some((r) => r.nomRole === 'TECHNICIEN')).toBe(true);
  });

  it('RESPONSABLE_IT ne figure plus dans AUTH_ONLY_ROLES', () => {
    expect(AUTH_ONLY_ROLES.some((r) => r.nomRole === 'RESPONSABLE_IT')).toBe(false);
  });

  it('DIRECTEUR_INNOVATION reste dans AUTH_ONLY_ROLES (aucune route dans ce module)', () => {
    expect(AUTH_ONLY_ROLES.some((r) => r.nomRole === 'DIRECTEUR_INNOVATION')).toBe(true);
  });

  it('MANAGE_SUPPORT_IT est attachée uniquement à RESPONSABLE_IT', () => {
    const perm = TEST_PERMISSIONS.find((p) => p.nomPermission === 'MANAGE_SUPPORT_IT');
    expect(perm?.roles).toEqual(['RESPONSABLE_IT']);
  });

  it('TRAITER_REQUETES_SUPPORT_IT est attachée uniquement à TECHNICIEN', () => {
    const perm = TEST_PERMISSIONS.find((p) => p.nomPermission === 'TRAITER_REQUETES_SUPPORT_IT');
    expect(perm?.roles).toEqual(['TECHNICIEN']);
  });

  it("chaque rôle référencé par une permission existe bien dans TEST_ROLES", () => {
    const roleNames = new Set(TEST_ROLES.map((r) => r.nomRole));
    for (const permission of TEST_PERMISSIONS) {
      for (const roleName of permission.roles) {
        expect(roleNames.has(roleName)).toBe(true);
      }
    }
  });
});
