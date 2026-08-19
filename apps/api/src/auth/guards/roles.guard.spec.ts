import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { CoursClasseController } from '../../pedagogie/cours-classe/cours-classe.controller';
import { RegistrationController } from '../../scolarite/registration/registration.controller';
import type { AuthenticatedUser } from '../interfaces/auth.interfaces';

/**
 * Vérifie que les 11 rôles "auth-only" (documentés dans CLAUDE.md, sans
 * module métier implémenté derrière — Bibliothèque, Finance/RH, Innovation
 * Numérique, Départements, portails Étudiant/Parent) sont bien REJETÉS
 * (403 via ForbiddenException) sur des routes métier existantes, exactement
 * comme SCOLARITE l'a été manuellement lors de l'audit précédent sur
 * /cours-classes. Aucune route ne référence ces rôles dans un @Roles() —
 * ce test le prouve en lisant les VRAIES métadonnées des controllers réels
 * (pas une copie codée en dur qui pourrait diverger du code).
 */
const AUTH_ONLY_ROLES = [
  'SUPER_ADMIN',
  'COMPTABLE',
  'RH',
  'DIRECTEUR_GENERAL',
  'DIRECTEUR_INNOVATION',
  'RESPONSABLE_PUBLICATIONS',
  'RESPONSABLE_IT',
  'ETUDIANT',
  'PARENT',
  'BIBLIOTHECAIRE',
  'RESPONSABLE_NUMERISATION',
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

describe('RolesGuard — 11 rôles auth-only rejetés sur des routes métier existantes', () => {
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
  });

  // Contrôle négatif : un rôle réellement autorisé passe bien (le test ne
  // rejette pas tout par accident, ex. Reflector mal configuré).
  it('contrôle positif : ENSEIGNANT (rôle réellement autorisé) passe sur /cours-classes', () => {
    const ctx = makeContext(['ENSEIGNANT'], CoursClasseController.prototype.findAll, CoursClasseController);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
