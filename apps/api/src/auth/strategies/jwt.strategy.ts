import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { AuthenticatedUser, JwtPayload } from '../interfaces/auth.interfaces';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret'),
    });
  }

  /**
   * Appelé par Passport après vérification de la signature et de l'expiration du JWT.
   * On effectue une vérification minimale en base (compte actif) et on retourne
   * le profil complet depuis le payload (évite une jointure lourde à chaque requête).
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.utilisateur.findUnique({
      where: { id: payload.sub },
      select: { estActif: true },
    });

    if (!user || !user.estActif) {
      throw new UnauthorizedException('Compte invalide ou désactivé');
    }

    return {
      id: payload.sub,
      email: payload.email,
      nom: payload.nom,
      prenom: payload.prenom,
      estActif: user.estActif,
      roles: payload.roles,
      permissions: payload.permissions,
    };
  }
}
