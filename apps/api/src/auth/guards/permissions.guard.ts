import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../interfaces/auth.interfaces';

/**
 * Guard RBAC basé sur les permissions granulaires.
 *
 * Règles d'évaluation :
 *  - Route @Public()               → passe (request.user peut être undefined)
 *  - Aucun @Permissions() défini   → passe
 *  - @Permissions('A', 'B')        → l'utilisateur doit avoir TOUTES les permissions (logique AND)
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Les routes @Public() sont exemptées — request.user peut être absent
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Pas de restriction de permission sur cette route
    if (!requiredPermissions?.length) return true;

    const user = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user;

    const hasAll = requiredPermissions.every((perm) =>
      user?.permissions?.includes(perm),
    );

    if (!hasAll) {
      throw new ForbiddenException(
        `Accès refusé. Permission(s) requise(s) : ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
