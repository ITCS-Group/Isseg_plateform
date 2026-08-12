import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../interfaces/auth.interfaces';

/**
 * Guard RBAC basé sur les rôles.
 *
 * Règles d'évaluation :
 *  - Route @Public()         → passe (request.user peut être undefined)
 *  - Aucun @Roles() défini   → passe (route protégée par JWT mais pas par rôle)
 *  - @Roles('A', 'B')        → l'utilisateur doit avoir AU MOINS l'un des rôles (logique OR)
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Les routes @Public() sont exemptées — request.user peut être absent
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Pas de restriction de rôle sur cette route
    if (!requiredRoles?.length) return true;

    const user = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user;

    const hasRole = requiredRoles.some((role) => user?.roles?.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(
        `Accès refusé. Rôle(s) requis : ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
