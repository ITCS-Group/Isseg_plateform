import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import type { AuthenticatedUser } from '../interfaces/auth.interfaces';

/**
 * LocalStrategy — Authentification par email/password
 *
 * Utilisée par le endpoint POST /auth/login.
 * Passport injecte automatiquement les champs du body dans validate().
 *
 * Configuration :
 * - usernameField: 'email' → récupère dto.email au lieu de dto.username
 * - passwordField: 'motDePasse' → récupère dto.motDePasse (nom français du champ)
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'motDePasse',
    });
  }

  /**
   * Appelée automatiquement par Passport après extraction de email/motDePasse du body.
   * Délègue la validation complète à AuthService.validateUser().
   *
   * @returns Utilisateur authentifié (attaché à request.user par Passport)
   * @throws UnauthorizedException si les identifiants sont invalides
   */
  async validate(email: string, motDePasse: string): Promise<AuthenticatedUser> {
    const user = await this.authService.validateUser(email, motDePasse);

    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    return user;
  }
}
