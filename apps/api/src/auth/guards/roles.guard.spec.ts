import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { CoursClasseController } from '../../pedagogie/cours-classe/cours-classe.controller';
import { RegistrationController } from '../../scolarite/registration/registration.controller';
import { OuvrageController } from '../../bibliotheque/ouvrages/ouvrage.controller';
import { EmpruntController } from '../../bibliotheque/emprunts/emprunt.controller';
import { AbonneController } from '../../bibliotheque/abonnes/abonne.controller';
import type { AuthenticatedUser } from '../interfaces/auth.interfaces';

/**
 * Vérifie que les 8 rôles "auth-only" restants (documentés dans CLAUDE.md,
 * sans module métier implémenté derrière — Finance/RH, Innovation
 * Numérique, Départements, portail Parent) sont bien REJETÉS (403 via
 * ForbiddenException) sur des routes métier existantes, exactement comme
 * SCOLARITE l'a été manuellement lors de l'audit précédent sur
 * /cours-classes. Aucune route ne référence ces rôles dans un @Roles() —
 * ce test le prouve en lisant les VRAIES métadonnées des controllers réels
 * (pas une copie codée en dur qui pourrait diverger du code).
 *
 * ETUDIANT, BIBLIOTHECAIRE et RESPONSABLE_NUMERISATION ont été retirés de
 * cette liste le 19/08 (chantier Bibliothèque) : ils ont désormais de
 * vraies routes @Roles() derrière eux — cf. describe "rôles Bibliothèque"
 * plus bas, qui vérifie l'inverse (accès accordé) pour ces rôles-là.
 */
const AUTH_ONLY_ROLES = [
  'SUPER_ADMIN',
  'COMPTABLE',
  'RH',
  'DIRECTEUR_GENERAL',
  'DIRECTEUR_INNOVATION',
  'RESPONSABLE_PUBLICATIONS',
  'RESPONSABLE_IT',
  'PARENT',
];

function makeUser(roles: string[]): AuthenticatedUser {
  return {
    id: 'user-test',
    email: 'test@isseg.local',
    nom: 'Test',
    prenom: 'Role',
    estActif: true,
    roles,
    permissions: [],
  };
}

function makeContext(roles: string[], handler: object, controllerClass: object): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controllerClass,
    switchToHttp: () => ({
      getRequest: () => ({ user: makeUser(roles) }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard — 8 rôles auth-only rejetés sur des routes métier existantes', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  describe.each(AUTH_ONLY_ROLES)('rôle %s', (role) => {
    it('GET /cours-classes (pédagogie, @Roles réels du controller) → ForbiddenException (403), pas d’accès accordé', () => {
      const ctx = makeContext([role], CoursClasseController.prototype.findAll, CoursClasseController);
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('POST /dossiers-inscription/:id/submit (scolarité, @Roles réels du controller) → ForbiddenException (403), pas d’accès accordé', () => {
      const ctx = makeContext([role], RegistrationController.prototype.submit, RegistrationController);
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('GET /ouvrages (bibliothèque, @Roles réels du controller) → ForbiddenException (403), pas d’accès accordé', () => {
      const ctx = makeContext([role], OuvrageController.prototype.findAll, OuvrageController);
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });

  // Contrôle négatif : un rôle réellement autorisé passe bien (le test ne
  // rejette pas tout par accident, ex. Reflector mal configuré).
  it('contrôle positif : ENSEIGNANT (rôle réellement autorisé) passe sur /cours-classes', () => {
    const ctx = makeContext(['ENSEIGNANT'], CoursClasseController.prototype.findAll, CoursClasseController);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});

/**
 * Chantier Bibliothèque (19/08) : ETUDIANT, BIBLIOTHECAIRE,
 * RESPONSABLE_NUMERISATION et RESPONSABLE_BIBLIOTHEQUE ont désormais de
 * vraies routes @Roles() derrière eux. Contrôle positif (accès accordé) —
 * même principe que le test ENSEIGNANT ci-dessus, sur les vraies métadonnées
 * des nouveaux controllers.
 */
describe('RolesGuard — rôles Bibliothèque, accès accordé sur leurs routes réelles', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  it('ETUDIANT passe sur GET /ouvrages (lecture catalogue)', () => {
    const ctx = makeContext(['ETUDIANT'], OuvrageController.prototype.findAll, OuvrageController);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('ETUDIANT passe sur GET /emprunts (ses propres emprunts)', () => {
    const ctx = makeContext(['ETUDIANT'], EmpruntController.prototype.findAll, EmpruntController);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('ETUDIANT est rejeté sur POST /ouvrages (gestion catalogue réservée au personnel)', () => {
    const ctx = makeContext(['ETUDIANT'], OuvrageController.prototype.create, OuvrageController);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('BIBLIOTHECAIRE passe sur POST /ouvrages (gestion catalogue)', () => {
    const ctx = makeContext(['BIBLIOTHECAIRE'], OuvrageController.prototype.create, OuvrageController);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('BIBLIOTHECAIRE passe sur GET /abonnes', () => {
    const ctx = makeContext(['BIBLIOTHECAIRE'], AbonneController.prototype.findAll, AbonneController);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('RESPONSABLE_BIBLIOTHEQUE passe sur GET /abonnes (supervision, pas fusionné dans BIBLIOTHECAIRE)', () => {
    const ctx = makeContext(['RESPONSABLE_BIBLIOTHEQUE'], AbonneController.prototype.findAll, AbonneController);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('RESPONSABLE_NUMERISATION est rejeté sur GET /abonnes (hors de son périmètre)', () => {
    const ctx = makeContext(['RESPONSABLE_NUMERISATION'], AbonneController.prototype.findAll, AbonneController);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
