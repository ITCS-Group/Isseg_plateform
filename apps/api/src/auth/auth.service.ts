import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditAction, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
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
  // Validation utilisateur (utilisée par LocalStrategy)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Valide les identifiants email/password d'un utilisateur.
   * Utilisée par LocalStrategy pour l'authentification Passport.
   *
   * @returns Profil utilisateur avec rôles et permissions, ou null si invalide
   */
  async validateUser(email: string, motDePasse: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.utilisateur.findUnique({
      where: { email },
      include: INCLUDE_ROLES_PERMISSIONS,
    });

    if (!user) {
      return null;
    }

    if (!user.estActif) {
      return null;
    }

    const passwordValid = await bcrypt.compare(motDePasse, user.motDePasseHash);
    if (!passwordValid) {
      return null;
    }

    return this.buildUserProfile(user);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Authentification
  // ─────────────────────────────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.utilisateur.findUnique({
      where: { email: dto.email },
      include: INCLUDE_ROLES_PERMISSIONS,
    });

    // ─────────────────────────────────────────────────────────────────────
    // CAS 1 : Compte inexistant
    // ─────────────────────────────────────────────────────────────────────
    if (!user) {
      // Créer un audit log avec utilisateurId = null
      await this.createAuditLog({
        utilisateurId: null,
        action: 'LOGIN_FAILED',
        details: { email: dto.email, raison: 'Compte inexistant' },
      });

      // Message générique pour éviter l'énumération d'utilisateurs
      throw new UnauthorizedException('Identifiants invalides');
    }

    // ─────────────────────────────────────────────────────────────────────
    // CAS 2 : Compte désactivé
    // ─────────────────────────────────────────────────────────────────────
    if (!user.estActif) {
      await this.createAuditLog({
        utilisateurId: user.id,
        action: 'LOGIN_FAILED',
        details: { email: user.email, raison: 'Compte désactivé' },
      });

      throw new UnauthorizedException('Identifiants invalides');
    }

    // ─────────────────────────────────────────────────────────────────────
    // CAS 3 : Compte verrouillé
    // ─────────────────────────────────────────────────────────────────────
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.createAuditLog({
        utilisateurId: user.id,
        action: 'LOGIN_FAILED',
        details: {
          email: user.email,
          raison: 'Compte verrouillé',
          lockedUntil: user.lockedUntil.toISOString(),
        },
      });

      throw new UnauthorizedException('Identifiants invalides');
    }

    // Si le verrouillage a expiré, on le réinitialise (ce sera fait après succès)

    // ─────────────────────────────────────────────────────────────────────
    // CAS 4 & 5 : Vérification du mot de passe
    // ─────────────────────────────────────────────────────────────────────
    const passwordValid = await bcrypt.compare(dto.motDePasse, user.motDePasseHash);

    if (!passwordValid) {
      // Incrémenter loginAttempts de manière atomique
      const updatedUser = await this.prisma.utilisateur.update({
        where: { id: user.id },
        data: {
          loginAttempts: { increment: 1 },
        },
        select: { loginAttempts: true },
      });

      const newLoginAttempts = updatedUser.loginAttempts;

      // Si on atteint 5 échecs, on verrouille le compte
      if (newLoginAttempts >= 5) {
        const lockedUntil = new Date();
        lockedUntil.setMinutes(lockedUntil.getMinutes() + 15); // 15 minutes

        await this.prisma.utilisateur.update({
          where: { id: user.id },
          data: {
            lockedUntil,
          },
        });

        // Créer un audit log ACCOUNT_LOCKED
        await this.createAuditLog({
          utilisateurId: user.id,
          action: 'ACCOUNT_LOCKED',
          details: {
            email: user.email,
            loginAttempts: newLoginAttempts,
            lockedUntil: lockedUntil.toISOString(),
          },
        });

        this.logger.warn(
          `Compte verrouillé après ${newLoginAttempts} tentatives : ${user.email}`,
        );
      }

      // Créer un audit log LOGIN_FAILED
      await this.createAuditLog({
        utilisateurId: user.id,
        action: 'LOGIN_FAILED',
        details: {
          email: user.email,
          raison: 'Mot de passe incorrect',
          loginAttempts: newLoginAttempts,
        },
      });

      throw new UnauthorizedException('Identifiants invalides');
    }

    // ─────────────────────────────────────────────────────────────────────
    // CAS 6 : Connexion réussie
    // ─────────────────────────────────────────────────────────────────────

    // Réinitialiser les compteurs et mettre à jour lastLoginAt
    await this.prisma.utilisateur.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Générer les tokens
    const profile = this.buildUserProfile(user);
    const tokens = await this.generateTokens(profile);

    // Stocker le refresh token
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    // Créer un audit log LOGIN_SUCCESS
    await this.createAuditLog({
      utilisateurId: user.id,
      action: 'LOGIN_SUCCESS',
      details: { email: user.email },
    });

    this.logger.log(`Connexion réussie : ${user.email}`);
    return tokens;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Rafraîchissement des tokens
  // ─────────────────────────────────────────────────────────────────────────────

  async refresh(dto: RefreshTokenDto): Promise<AuthTokens> {
    // ═════════════════════════════════════════════════════════════════════
    // PHASE A — HORS TRANSACTION
    // ═════════════════════════════════════════════════════════════════════

    // A.1 — Vérifier la signature JWT du refresh token
    const payload = this.verifyRefreshToken(dto.refreshToken);

    // A.2 — Calculer le hash SHA-256 du refresh token
    const tokenHash = this.sha256(dto.refreshToken);

    // ═════════════════════════════════════════════════════════════════════
    // PHASE B — TRANSACTION INTERACTIVE (PROTECTION RACE CONDITION)
    // ═════════════════════════════════════════════════════════════════════

    const newTokens = await this.prisma.$transaction(async (tx) => {
      // ───────────────────────────────────────────────────────────────────
      // B.1 — Rechercher le token dans la base de données
      // ───────────────────────────────────────────────────────────────────
      const storedToken = await tx.refreshToken.findUnique({
        where: { tokenHash },
        include: {
          utilisateur: {
            include: INCLUDE_ROLES_PERMISSIONS,
          },
        },
      });

      // ───────────────────────────────────────────────────────────────────
      // B.2 — Validations métier de sécurité
      // Message générique pour éviter la divulgation d'informations
      // ───────────────────────────────────────────────────────────────────

      // Validation 1 : Token inexistant en base
      if (!storedToken) {
        throw new UnauthorizedException('Token de rafraîchissement invalide');
      }

      // Validation 2 : Token déjà révoqué
      if (storedToken.isRevoked) {
        // NOTE : Possibilité future de révoquer tous les tokens de l'utilisateur
        // en cas de détection de réutilisation d'un token révoqué (protection vol)
        throw new UnauthorizedException('Token de rafraîchissement invalide');
      }

      // Validation 3 : Token expiré
      if (storedToken.expiresAt <= new Date()) {
        throw new UnauthorizedException('Token de rafraîchissement invalide');
      }

      // Validation 4 : Utilisateur inexistant (ne devrait jamais arriver avec CASCADE)
      if (!storedToken.utilisateur) {
        throw new UnauthorizedException('Token de rafraîchissement invalide');
      }

      // Validation 5 : Compte utilisateur désactivé
      if (!storedToken.utilisateur.estActif) {
        throw new UnauthorizedException('Token de rafraîchissement invalide');
      }

      // Validation 6 : Vérifier la cohérence entre le JWT et la base de données
      // Ne pas faire confiance uniquement au contenu du JWT
      if (payload.sub !== storedToken.utilisateurId) {
        this.logger.warn(
          `Incohérence JWT/DB : JWT sub=${payload.sub}, DB utilisateurId=${storedToken.utilisateurId}`,
        );
        throw new UnauthorizedException('Token de rafraîchissement invalide');
      }

      // ───────────────────────────────────────────────────────────────────
      // B.3 — OPÉRATION ATOMIQUE : UPDATE CONDITIONNEL (RACE CONDITION PROTECTION)
      // ───────────────────────────────────────────────────────────────────
      // Cette opération est la GARANTIE D'EXCLUSIVITÉ contre la concurrence.
      // PostgreSQL garantit que seule UNE requête parmi N concurrentes peut
      // réussir l'UPDATE avec la condition isRevoked=false.
      // ───────────────────────────────────────────────────────────────────
      const revokeResult = await tx.refreshToken.updateMany({
        where: {
          tokenHash,
          isRevoked: false, // ⚠️ CONDITION CRITIQUE
        },
        data: {
          isRevoked: true,
        },
      });

      // ───────────────────────────────────────────────────────────────────
      // B.4 — Vérification du count (détection race condition)
      // ───────────────────────────────────────────────────────────────────
      // Si count !== 1, cela signifie qu'une autre requête concurrente
      // a déjà révoqué ce token (race condition détectée).
      // ───────────────────────────────────────────────────────────────────
      if (revokeResult.count !== 1) {
        throw new UnauthorizedException('Token de rafraîchissement invalide');
      }

      // ───────────────────────────────────────────────────────────────────
      // B.5 — Générer les nouveaux tokens
      // ───────────────────────────────────────────────────────────────────
      const profile = this.buildUserProfile(storedToken.utilisateur);
      const newTokens = await this.generateTokens(profile);
      const newTokenHash = this.sha256(newTokens.refreshToken);
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 7); // 7 jours

      // ───────────────────────────────────────────────────────────────────
      // B.6 — Créer le nouveau refresh token
      // ───────────────────────────────────────────────────────────────────
      await tx.refreshToken.create({
        data: {
          tokenHash: newTokenHash,
          utilisateurId: storedToken.utilisateurId,
          expiresAt: newExpiresAt,
          isRevoked: false,
        },
      });

      // ───────────────────────────────────────────────────────────────────
      // B.7 — Audit log TOKEN_REFRESHED (dans la transaction)
      // ───────────────────────────────────────────────────────────────────
      await tx.auditLog.create({
        data: {
          utilisateurId: storedToken.utilisateurId,
          action: 'TOKEN_REFRESHED',
          details: { email: storedToken.utilisateur.email },
        },
      });

      this.logger.log(`Tokens rafraîchis : ${storedToken.utilisateur.email}`);

      // ───────────────────────────────────────────────────────────────────
      // B.8 — Retourner les nouveaux tokens (COMMIT implicite après ce return)
      // ───────────────────────────────────────────────────────────────────
      return newTokens;
    });

    return newTokens;
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
    // ═════════════════════════════════════════════════════════════════════
    // B5 — LOGOUT
    // ═════════════════════════════════════════════════════════════════════
    // Révoque tous les refresh tokens actifs de l'utilisateur et crée un
    // audit log LOGOUT.
    //
    // NOTE : L'access token reste valide jusqu'à son expiration naturelle
    // (15 min max). Il n'y a pas de blacklist côté serveur pour les access
    // tokens (stateless JWT).
    // ═════════════════════════════════════════════════════════════════════

    await this.prisma.$transaction(async (tx) => {
      // ───────────────────────────────────────────────────────────────────
      // 1. Révoquer tous les refresh tokens actifs de l'utilisateur
      // ───────────────────────────────────────────────────────────────────
      const revokeResult = await tx.refreshToken.updateMany({
        where: {
          utilisateurId: userId,
          isRevoked: false, // Révoquer uniquement les tokens actifs
        },
        data: {
          isRevoked: true,
        },
      });

      this.logger.log(
        `Déconnexion : ${revokeResult.count} refresh token(s) révoqué(s) pour utilisateur ${userId}`,
      );

      // ───────────────────────────────────────────────────────────────────
      // 2. Créer un audit log LOGOUT
      // ───────────────────────────────────────────────────────────────────
      // Note : On crée toujours l'audit log même si aucun token n'a été
      // révoqué (l'utilisateur peut se déconnecter plusieurs fois)
      await tx.auditLog.create({
        data: {
          utilisateurId: userId,
          action: 'LOGOUT',
          details: {
            tokensRevoked: revokeResult.count,
          },
        },
      });
    });
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

    // `jti` : identifiant unique par émission.
    //
    // Sans lui, le payload se réduit à { sub, type } et les seules parties
    // variables du JWT sont `iat` et `exp`, exprimés à la seconde. Deux
    // émissions pour le MÊME utilisateur dans la MÊME seconde produisent donc
    // un jeton identique au bit près, donc le même SHA-256, qui viole la
    // contrainte d'unicité sur RefreshToken.tokenHash. Cas nominal : un client
    // qui rafraîchit immédiatement après la connexion, ou deux connexions
    // simultanées — l'utilisateur recevait alors une erreur 500.
    //
    // `jti` n'est volontairement PAS vérifié dans verifyRefreshToken() : les
    // refresh tokens déjà émis n'en portent pas, et les invalider ferait
    // tomber toutes les sessions ouvertes au déploiement.
    const refreshPayload: RefreshPayload = {
      sub: user.id,
      type: 'refresh',
      jti: randomUUID(),
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
   * Stocke un hash SHA-256 du refresh token dans la table RefreshToken.
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
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 jours

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: hash,
        utilisateurId: userId,
        expiresAt,
        isRevoked: false,
      },
    });
  }

  private sha256(input: string): string {
    return createHash('sha256').update(input).digest('hex');
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

  /**
   * Crée un audit log pour une action d'authentification.
   *
   * IMPORTANT : Ne jamais enregistrer dans les details :
   * - Le mot de passe en clair
   * - L'access token
   * - Le refresh token brut
   */
  private async createAuditLog(params: {
    utilisateurId: string | null;
    action: AuditAction;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        utilisateurId: params.utilisateurId,
        action: params.action,
        details: params.details || {},
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  }
}
