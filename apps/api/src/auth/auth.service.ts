import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '../database/prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';
import type { RefreshTokenDto } from './dto/refresh-token.dto';
import type {
  AuthenticatedUser,
  AuthTokens,
  JwtPayload,
  RefreshPayload,
} from './interfaces/auth.interfaces';

/** Type Prisma pour un utilisateur avec ses rôles et permissions imbriqués */
type UtilisateurAvecRoles = Prisma.UtilisateurGetPayload<{
  include: {
    roles: {
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } };
          };
        };
      };
    };
  };
}>;

/** Include Prisma réutilisé pour charger les rôles et permissions */
const INCLUDE_ROLES_PERMISSIONS = {
  roles: {
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  },
} satisfies Prisma.UtilisateurInclude;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // Authentification
  // ─────────────────────────────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.utilisateur.findUnique({
      where: { email: dto.email },
      include: INCLUDE_ROLES_PERMISSIONS,
    });

    // Message volontairement générique — évite l'énumération d'utilisateurs
    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (!user.estActif) {
      throw new UnauthorizedException('Ce compte est désactivé');
    }

    const passwordValid = await bcrypt.compare(dto.motDePasse, user.motDePasseHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const profile = this.buildUserProfile(user);
    const tokens = await this.generateTokens(profile);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`Connexion réussie : ${user.email}`);
    return tokens;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Rafraîchissement des tokens
  // ─────────────────────────────────────────────────────────────────────────────

  async refresh(dto: RefreshTokenDto): Promise<AuthTokens> {
    const payload = this.verifyRefreshToken(dto.refreshToken);

    const user = await this.prisma.utilisateur.findUnique({
      where: { id: payload.sub },
      include: INCLUDE_ROLES_PERMISSIONS,
    });

    if (!user || !user.estActif || !user.refreshTokenHash) {
      throw new UnauthorizedException('Session invalide ou expirée');
    }

    const tokenMatches = this.verifyStoredToken(dto.refreshToken, user.refreshTokenHash);
    if (!tokenMatches) {
      // Détection de réutilisation : révocation immédiate de la session
      await this.revokeSession(user.id);
      this.logger.warn(`Réutilisation de refresh token détectée : ${user.email}`);
      throw new UnauthorizedException('Token révoqué — reconnectez-vous');
    }

    const profile = this.buildUserProfile(user);
    const tokens = await this.generateTokens(profile);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Profil courant
  // ─────────────────────────────────────────────────────────────────────────────

  async getProfile(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
      include: INCLUDE_ROLES_PERMISSIONS,
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable');
    }

    return this.buildUserProfile(user);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Déconnexion
  // ─────────────────────────────────────────────────────────────────────────────

  async logout(userId: string): Promise<void> {
    await this.revokeSession(userId);
    this.logger.log(`Déconnexion : utilisateur ${userId}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Méthodes privées
  // ─────────────────────────────────────────────────────────────────────────────

  private buildUserProfile(user: UtilisateurAvecRoles): AuthenticatedUser {
    const roles = user.roles.map((ur) => ur.role.nomRole);
    const permissions = [
      ...new Set(
        user.roles.flatMap((ur) =>
          ur.role.permissions.map((rp) => rp.permission.nomPermission),
        ),
      ),
    ];

    return {
      id: user.id,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      estActif: user.estActif,
      roles,
      permissions,
    };
  }

  private async generateTokens(user: AuthenticatedUser): Promise<AuthTokens> {
    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      roles: user.roles,
      permissions: user.permissions,
    };

    const refreshPayload: RefreshPayload = {
      sub: user.id,
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.config.get<string>('jwt.secret'),
        expiresIn: this.config.get<string>('jwt.expiresIn'),
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: this.config.get<string>('jwt.refreshExpiresIn'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Stocke un hash SHA-256 du refresh token en base.
   *
   * Pourquoi SHA-256 et non bcrypt ?
   * - bcrypt tronque silencieusement les inputs à 72 octets (limitation interne de Blowfish).
   *   Un JWT refresh token fait ~200 caractères → seuls les 72 premiers octets seraient hashés,
   *   rendant la comparaison partiellement inefficace et la détection de réutilisation faillible.
   * - Le refresh token est généré par le système avec une haute entropie (signé HMAC-SHA256).
   *   SHA-256 est suffisant : l'attaquant ne peut pas le brute-forcer car il ne connaît pas
   *   JWT_REFRESH_SECRET. bcrypt ne bénéficie ici qu'à la marge.
   * - SHA-256 est <1ms vs ~300ms pour bcrypt 12 rounds — gain direct sur chaque login/refresh.
   */
  private async storeRefreshToken(userId: string, rawToken: string): Promise<void> {
    const hash = this.sha256(rawToken);
    await this.prisma.utilisateur.update({
      where: { id: userId },
      data: { refreshTokenHash: hash },
    });
  }

  /**
   * Comparaison timing-safe : empêche les attaques par timing sur la comparaison de hash.
   */
  private verifyStoredToken(rawToken: string, storedHash: string): boolean {
    const incoming = Buffer.from(this.sha256(rawToken), 'hex');
    const stored   = Buffer.from(storedHash, 'hex');

    if (incoming.length !== stored.length) return false;
    return timingSafeEqual(incoming, stored);
  }

  private sha256(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }

  private async revokeSession(userId: string): Promise<void> {
    await this.prisma.utilisateur.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  private verifyRefreshToken(token: string): RefreshPayload {
    try {
      const payload = this.jwtService.verify<RefreshPayload>(token, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });

      if (payload.type !== 'refresh') {
        throw new Error('Type de token invalide');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Token de rafraîchissement invalide ou expiré');
    }
  }
}
