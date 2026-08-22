import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
import { AbandonService } from './abandon.service';
import { AbandonListResponseDto } from './dto/abandon-list.response.dto';
import { AbandonResponseDto } from './dto/abandon.response.dto';
import { DeciderRepriseDto } from './dto/decider-reprise.dto';
import { QueryAbandonDto } from './dto/query-abandon.dto';
import { SignalerAbandonDto } from './dto/signaler-abandon.dto';

/**
 * Contrôleur MINCE d'exposition du workflow Abandon.
 *
 * HTTP → JwtAuthGuard (401) → RolesGuard (403) → ValidationPipe/ParseUUIDPipe (400)
 *      → @CurrentUser('id') → AbandonService.
 *
 * Aucune logique métier ici : la machine à états et les règles restent dans
 * le service. `actorId` provient EXCLUSIVEMENT du JWT (jamais du body).
 */
@ApiTags('Abandons')
@ApiBearerAuth('JWT')
@Roles('SCOLARITE', 'ADMIN')
@ApiResponse({ status: 401, description: 'Non authentifié (JWT absent ou invalide)' })
@ApiResponse({ status: 403, description: 'Rôle insuffisant (SCOLARITE ou ADMIN requis)' })
@ApiResponse({ status: 400, description: 'DTO invalide ou identifiant non-UUID' })
@Controller({ path: 'abandons', version: '1' })
export class AbandonController {
  constructor(private readonly abandonService: AbandonService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les abandons (paginé, filtrable par statut/étudiant/année)' })
  @ApiResponse({ status: 200, type: AbandonListResponseDto })
  findAll(@Query() query: QueryAbandonDto): Promise<AbandonListResponseDto> {
    return this.abandonService.findAll(query);
  }

  // ── POST /api/v1/abandons ───────────────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Signaler un abandon (crée en CONSTATE, désactive l\'inscription correspondante)' })
  @ApiBody({ type: SignalerAbandonDto })
  @ApiResponse({ status: 201, type: AbandonResponseDto })
  @ApiResponse({ status: 404, description: 'Inscription introuvable pour cet étudiant/cette année' })
  @ApiResponse({ status: 409, description: 'Abandon déjà déclaré pour cet étudiant sur cette année' })
  signaler(
    @Body() dto: SignalerAbandonDto,
    @CurrentUser('id') actorId: string,
  ): Promise<AbandonResponseDto> {
    return this.abandonService.signaler(dto, actorId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un abandon par UUID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: AbandonResponseDto })
  @ApiResponse({ status: 404, description: 'Abandon introuvable' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<AbandonResponseDto> {
    return this.abandonService.findOne(id);
  }

  // ── POST /api/v1/abandons/:id/demander-reprise ────────────────────────────
  @Post(':id/demander-reprise')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Demander la reprise (CONSTATE → REPRISE_DEMANDEE, ou nouveau recours REPRISE_REFUSEE → REPRISE_DEMANDEE)',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'UUID de l\'abandon' })
  @ApiResponse({ status: 200, type: AbandonResponseDto })
  @ApiResponse({ status: 404, description: 'Abandon introuvable' })
  @ApiResponse({ status: 409, description: 'Conflit de concurrence' })
  @ApiResponse({ status: 422, description: 'Transition métier interdite' })
  demanderReprise(@Param('id', ParseUUIDPipe) id: string): Promise<AbandonResponseDto> {
    return this.abandonService.demanderReprise(id);
  }

  // ── POST /api/v1/abandons/:id/decider-reprise ─────────────────────────────
  @Post(':id/decider-reprise')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Décider de la reprise (REPRISE_DEMANDEE → REPRISE_ACCORDEE | REPRISE_REFUSEE)',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'UUID de l\'abandon' })
  @ApiBody({ type: DeciderRepriseDto })
  @ApiResponse({ status: 200, type: AbandonResponseDto })
  @ApiResponse({ status: 404, description: 'Abandon introuvable' })
  @ApiResponse({ status: 409, description: 'Conflit de concurrence' })
  @ApiResponse({ status: 422, description: 'Transition métier interdite' })
  deciderReprise(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId: string,
    @Body() dto: DeciderRepriseDto,
  ): Promise<AbandonResponseDto> {
    return this.abandonService.deciderReprise(id, actorId, dto);
  }
}
