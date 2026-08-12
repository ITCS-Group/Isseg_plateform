import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';

/**
 * Injecte l'utilisateur courant (issu du JWT validé) dans le paramètre du handler.
 *
 * @example
 * // Tout l'objet utilisateur
 * login(@CurrentUser() user: AuthenticatedUser)
 *
 * @example
 * // Un seul champ
 * whoAmI(@CurrentUser('id') userId: string)
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    const user = request.user;
    return field ? user?.[field] : user;
  },
);
