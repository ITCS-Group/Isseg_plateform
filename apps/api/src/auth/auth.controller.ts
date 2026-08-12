import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
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
import { AuthTokensResponseDto } from './dto/auth-tokens.response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UserProfileResponseDto } from './dto/user-profile.response.dto';
import type { AuthenticatedUser } from './interfaces/auth.interfaces';

@ApiTags('Authentification')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
      'Authentifie un utilisateur et retourne une paire de tokens JWT (access + refresh).' +
      '\n\n**Access token** : durée de vie courte (15 min), à inclure dans `Authorization: Bearer <token>`.' +
      '\n\n**Refresh token** : durée de vie longue (7 j), à utiliser sur `/auth/refresh`.' +
      '\n\n⚠️ Limité à **5 tentatives / minute / IP**.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Authentification réussie', type: AuthTokensResponseDto })
  @ApiResponse({ status: 400, description: 'Corps de requête invalide (validation DTO)' })
  @ApiResponse({ status: 401, description: 'Identifiants invalides ou compte désactivé' })
  @ApiResponse({ status: 429, description: 'Trop de tentatives — réessayez dans 60 secondes' })
  async login(@Body() dto: LoginDto): Promise<AuthTokensResponseDto> {
    return this.authService.login(dto);
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
      'Émet une nouvelle paire de tokens à partir d\'un refresh token valide.' +
      '\n\n⚠️ Chaque refresh token est à **usage unique** (rotation). En cas de réutilisation,' +
      ' la session est immédiatement révoquée (protection contre le vol de token).',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'Nouvelle paire de tokens émise', type: AuthTokensResponseDto })
  @ApiResponse({ status: 401, description: 'Refresh token invalide, expiré ou révoqué' })
  @ApiResponse({ status: 429, description: 'Trop de requêtes' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensResponseDto> {
    return this.authService.refresh(dto);
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
      'Révoque le refresh token stocké en base. ' +
      'L\'access token reste valide jusqu\'à son expiration naturelle (15 min max).',
  })
  @ApiResponse({ status: 204, description: 'Déconnexion réussie' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  async logout(@CurrentUser('id') userId: string): Promise<void> {
    return this.authService.logout(userId);
  }
}
