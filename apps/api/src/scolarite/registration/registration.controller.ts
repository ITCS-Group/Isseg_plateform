import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RejectDossierDto } from './dto/reject-dossier.dto';
import { TransitionDto } from './dto/transition.dto';
import { TransitionResultResponseDto } from './dto/transition-result.response.dto';
import { RegistrationWorkflowService } from './registration-workflow.service';
import type { TransitionResult } from './registration.types';

/**
 * Contrôleur MINCE d'exposition du workflow d'inscription (B1.1).
 *
 * HTTP → JwtAuthGuard (401) → RolesGuard (403) → ValidationPipe/ParseUUIDPipe (400)
 *      → @CurrentUser('id') → RegistrationWorkflowService.
 *
 * Aucune logique métier ici : la machine à états et les règles restent dans le
 * service. `actorId` provient EXCLUSIVEMENT du JWT (jamais du body).
 */
@ApiTags('Inscriptions')
@ApiBearerAuth('JWT')
@Roles('SCOLARITE', 'ADMIN')
@ApiResponse({ status: 401, description: 'Non authentifié (JWT absent ou invalide)' })
@ApiResponse({ status: 403, description: 'Rôle insuffisant (SCOLARITE ou ADMIN requis)' })
@ApiResponse({ status: 400, description: 'DTO invalide ou identifiant non-UUID' })
@ApiResponse({ status: 404, description: 'Dossier introuvable' })
@ApiResponse({ status: 409, description: 'Conflit de version / concurrence (optimistic locking)' })
@ApiResponse({ status: 422, description: 'Transition métier interdite' })
@Controller({ path: 'dossiers-inscription', version: '1' })
export class RegistrationController {
  constructor(private readonly workflow: RegistrationWorkflowService) {}

  // ── POST /api/v1/dossiers-inscription/:id/submit ──────────────────────────
  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'T1 — Soumettre un dossier (BROUILLON → SOUMIS)',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'UUID du dossier' })
  @ApiBody({ type: TransitionDto })
  @ApiResponse({ status: 200, type: TransitionResultResponseDto })
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId: string,
    @Body() dto: TransitionDto,
  ): Promise<TransitionResult> {
    return this.workflow.submit(id, actorId, dto);
  }

  // ── POST /api/v1/dossiers-inscription/:id/start-processing ────────────────
  @Post(':id/start-processing')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'T2 — Prendre en traitement (SOUMIS → EN_TRAITEMENT)',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'UUID du dossier' })
  @ApiBody({ type: TransitionDto })
  @ApiResponse({ status: 200, type: TransitionResultResponseDto })
  startProcessing(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId: string,
    @Body() dto: TransitionDto,
  ): Promise<TransitionResult> {
    return this.workflow.startProcessing(id, actorId, dto);
  }

  // ── POST /api/v1/dossiers-inscription/:id/register ────────────────────────
  @Post(':id/register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'T3 — Inscrire (EN_TRAITEMENT → INSCRIT) + attribution du matricule',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'UUID du dossier' })
  @ApiBody({ type: TransitionDto })
  @ApiResponse({ status: 200, type: TransitionResultResponseDto })
  register(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId: string,
    @Body() dto: TransitionDto,
  ): Promise<TransitionResult> {
    return this.workflow.register(id, actorId, dto);
  }

  // ── POST /api/v1/dossiers-inscription/:id/reject ──────────────────────────
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'T4 — Rejeter (EN_TRAITEMENT → REJETE), motif obligatoire',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'UUID du dossier' })
  @ApiBody({ type: RejectDossierDto })
  @ApiResponse({ status: 200, type: TransitionResultResponseDto })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId: string,
    @Body() dto: RejectDossierDto,
  ): Promise<TransitionResult> {
    return this.workflow.reject(id, actorId, dto);
  }
}
