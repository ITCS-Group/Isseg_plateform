import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { EpreuveController } from './epreuve.controller';

/**
 * Vérifie les métadonnées @Roles() RÉELLEMENT enregistrées sur le controller,
 * via Reflector (même mécanisme que RolesGuard) — pas une constante dupliquée
 * dans le test. Échoue si les rôles du controller changent involontairement.
 */
describe('EpreuveController — RBAC (métadonnées @Roles)', () => {
  const reflector = new Reflector();

  it('classe : ADMIN par défaut (valeur héritée par remove())', () => {
    const roles = reflector.get<string[]>(ROLES_KEY, EpreuveController);
    expect(roles).toEqual(['ADMIN']);
  });

  it('findAll : ADMIN, DGA_ETUDES, CHEF_DEPARTEMENT, ENSEIGNANT', () => {
    const roles = reflector.get<string[]>(ROLES_KEY, EpreuveController.prototype.findAll);
    expect(roles).toEqual(['ADMIN', 'DGA_ETUDES', 'CHEF_DEPARTEMENT', 'ENSEIGNANT']);
  });

  it('create : ADMIN, DGA_ETUDES, ENSEIGNANT', () => {
    const roles = reflector.get<string[]>(ROLES_KEY, EpreuveController.prototype.create);
    expect(roles).toEqual(['ADMIN', 'DGA_ETUDES', 'ENSEIGNANT']);
  });

  it('findOne : ADMIN, DGA_ETUDES, CHEF_DEPARTEMENT, ENSEIGNANT', () => {
    const roles = reflector.get<string[]>(ROLES_KEY, EpreuveController.prototype.findOne);
    expect(roles).toEqual(['ADMIN', 'DGA_ETUDES', 'CHEF_DEPARTEMENT', 'ENSEIGNANT']);
  });

  it('remove : aucune métadonnée locale → hérite ADMIN de la classe', () => {
    const roles = reflector.get<string[]>(ROLES_KEY, EpreuveController.prototype.remove);
    expect(roles).toBeUndefined();

    // Reproduit la résolution effective de RolesGuard (getAllAndOverride) :
    // méthode d'abord, puis classe si absente au niveau méthode.
    const effective =
      reflector.get<string[]>(ROLES_KEY, EpreuveController.prototype.remove) ??
      reflector.get<string[]>(ROLES_KEY, EpreuveController);
    expect(effective).toEqual(['ADMIN']);
  });
});
