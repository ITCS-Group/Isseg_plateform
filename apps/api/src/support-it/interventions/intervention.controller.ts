import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateInterventionDto } from './dto/create-intervention.dto';
import { InterventionResponseDto } from './dto/intervention.response.dto';
import { InterventionService } from './intervention.service';

@ApiTags('Support IT — Interventions')
@ApiBearerAuth('JWT')
@Controller({ path: 'requetes/:requeteId/interventions', version: '1' })
export class InterventionController {
  constructor(private readonly interventionService: InterventionService) {}

  // ── POST /api/v1/requetes/:requeteId/interventions ──────────────────────

  @Post()
  @Roles('TECHNICIEN')
  @ApiOperation({
    summary: 'Enregistrer une intervention sur une requête',
    description:
      'Réservé au TECHNICIEN du sous-service ciblé par la requête. Passe automatiquement la ' +
      'requête au statut EN_COURS si elle était encore OUVERTE.',
  })
  @ApiParam({ name: 'requeteId', format: 'uuid' })
  @ApiBody({ type: CreateInterventionDto })
  @ApiResponse({ status: 201, type: InterventionResponseDto })
  @ApiResponse({ status: 403, description: 'Technicien d’un autre sous-service, ou sans profil Technicien' })
  @ApiResponse({ status: 404, description: 'Requête introuvable' })
  @ApiResponse({ status: 409, description: 'Requête déjà clôturée' })
  create(
    @Param('requeteId', ParseUUIDPipe) requeteId: string,
    @Body() dto: CreateInterventionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InterventionResponseDto> {
    return this.interventionService.create(requeteId, dto, user.id);
  }

  // ── GET /api/v1/requetes/:requeteId/interventions ────────────────────────

  @Get()
  @ApiOperation({ summary: 'Lister les interventions d’une requête' })
  @ApiParam({ name: 'requeteId', format: 'uuid' })
  @ApiResponse({ status: 200, type: [InterventionResponseDto] })
  @ApiResponse({ status: 403, description: 'Requête hors du périmètre de l’appelant' })
  @ApiResponse({ status: 404, description: 'Requête introuvable' })
  findAllForRequete(
    @Param('requeteId', ParseUUIDPipe) requeteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InterventionResponseDto[]> {
    return this.interventionService.findAllForRequete(requeteId, user);
  }
}
