import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { AccessTokenResponseDto } from './dto/access-token.response.dto';
import { LoginDto } from './dto/login.dto';
import { UserProfileResponseDto } from './dto/user-profile.response.dto';
import type { AuthenticatedUser } from './interfaces/auth.interfaces';

@ApiTags('Authentification')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /api/v1/auth/login
  // ─────────────────────────────────────────────────────────────────────────────

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  // Throttling strict : 5 tentatives / minute / IP (protection brute-force)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: 'Connexion',
    description:
      'Authentifie un utilisateur et retourne un access token JWT.' +
      '\n\n**Access token** : durée de vie courte (15 min), à inclure dans `Authorization: Bearer <token>`.' +
      '\n\n**Refresh token** : stocké automatiquement dans un cookie HttpOnly sécurisé.' +
      '\n\n⚠️ Limité à **5 tentatives / minute / IP**.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Authentification réussie',
    type: AccessTokenResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Corps de requête invalide (validation DTO)' })
  @ApiResponse({ status: 401, description: 'Identifiants invalides ou compte désactivé' })
  @ApiResponse({ status: 429, description: 'Trop de tentatives — réessayez dans 60 secondes' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: any,
  ): Promise<AccessTokenResponseDto> {
    const { accessToken, refreshToken } = await this.authService.login(dto);

    // Stocker le refresh token dans un cookie HttpOnly
    res.cookie(
      this.config.get<string>('cookie.name', 'refreshToken'),
      refreshToken,
      {
        httpOnly: this.config.get<boolean>('cookie.httpOnly', true),
        secure: this.config.get<boolean>('cookie.secure', false),
        sameSite: this.config.get<'strict' | 'lax' | 'none'>('cookie.sameSite', 'strict'),
        maxAge: this.config.get<number>('cookie.maxAge', 7 * 24 * 60 * 60 * 1000),
        path: '/api/v1/auth',
      },
    );

    // Retourner uniquement l'access token dans le body
    return { accessToken };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /api/v1/auth/refresh
  // ─────────────────────────────────────────────────────────────────────────────

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  // Throttling modéré : 10 refresh / minute / IP (les clients légitimes refreshent rarement)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: 'Rafraîchissement des tokens',
    description:
      'Émet un nouveau access token à partir du refresh token stocké dans le cookie.' +
      '\n\n⚠️ Chaque refresh token est à **usage unique** (rotation). En cas de réutilisation,' +
      ' la session est immédiatement révoquée (protection contre le vol de token).',
  })
  @ApiResponse({
    status: 200,
    description: 'Nouveau access token émis',
    type: AccessTokenResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Refresh token invalide, expiré ou révoqué' })
  @ApiResponse({ status: 429, description: 'Trop de requêtes' })
  async refresh(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ): Promise<AccessTokenResponseDto> {
    const cookieName = this.config.get<string>('cookie.name', 'refreshToken');
    const refreshToken = req.cookies?.[cookieName];

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token manquant');
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refresh({ refreshToken });

    // Stocker le nouveau refresh token dans le cookie (rotation)
    res.cookie(cookieName, newRefreshToken, {
      httpOnly: this.config.get<boolean>('cookie.httpOnly', true),
      secure: this.config.get<boolean>('cookie.secure', false),
      sameSite: this.config.get<'strict' | 'lax' | 'none'>('cookie.sameSite', 'strict'),
      maxAge: this.config.get<number>('cookie.maxAge', 7 * 24 * 60 * 60 * 1000),
      path: '/api/v1/auth',
    });

    // Retourner uniquement le nouvel access token dans le body
    return { accessToken };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /api/v1/auth/me
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('me')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Profil courant',
    description:
      'Retourne le profil complet de l\'utilisateur authentifié, incluant ses rôles et permissions actuels.',
  })
  @ApiResponse({ status: 200, description: 'Profil récupéré', type: UserProfileResponseDto })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserProfileResponseDto> {
    return this.authService.getProfile(user.id);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /api/v1/auth/logout
  // ─────────────────────────────────────────────────────────────────────────────

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Déconnexion',
    description:
      'Révoque le refresh token stocké en base et supprime le cookie. ' +
      'L\'access token reste valide jusqu\'à son expiration naturelle (15 min max).',
  })
  @ApiResponse({ status: 204, description: 'Déconnexion réussie' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  async logout(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: any,
  ): Promise<void> {
    await this.authService.logout(userId);

    // Supprimer le cookie de refresh token
    res.clearCookie(this.config.get<string>('cookie.name', 'refreshToken'), {
      path: '/api/v1/auth',
    });
  }
}
