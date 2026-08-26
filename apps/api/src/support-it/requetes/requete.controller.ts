import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateRequeteDto } from './dto/create-requete.dto';
import { ListRequeteQueryDto } from './dto/list-requete-query.dto';
import { PaginatedRequeteResponseDto, RequeteResponseDto } from './dto/requete.response.dto';
import { RequeteService } from './requete.service';

@ApiTags('Support IT — Requêtes')
@ApiBearerAuth('JWT')
@Controller({ path: 'requetes', version: '1' })
export class RequeteController {
  constructor(private readonly requeteService: RequeteService) {}

  // ── POST /api/v1/requetes ────────────────────────────────────────────────

  @Post()
  @ApiOperation({
    summary: 'Ouvrir une requête Support Informatique',
    description:
      'Le sous-service destinataire (centre informatique/cyber/maintenance) est déterminé ' +
      "automatiquement à partir de la nature de la requête. Réservé aux comptes disposant " +
      "d'un profil Personnel.",
  })
  @ApiBody({ type: CreateRequeteDto })
  @ApiResponse({ status: 201, type: RequeteResponseDto })
  @ApiResponse({ status: 403, description: 'Aucun profil Personnel associé au compte' })
  create(
    @Body() dto: CreateRequeteDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequeteResponseDto> {
    return this.requeteService.create(dto, user.id);
  }

  // ── GET /api/v1/requetes ─────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'Lister les requêtes',
    description:
      'Un demandeur ne voit que ses propres requêtes. Un TECHNICIEN ne voit que celles de son ' +
      'propre sous-service. RESPONSABLE_IT/ADMIN voient tout.',
  })
  @ApiResponse({ status: 200, type: PaginatedRequeteResponseDto })
  findAll(
    @Query() query: ListRequeteQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedRequeteResponseDto> {
    return this.requeteService.findAll(query, user);
  }

  // ── GET /api/v1/requetes/:id ─────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’une requête' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: RequeteResponseDto })
  @ApiResponse({ status: 403, description: 'Requête hors du périmètre de l’appelant' })
  @ApiResponse({ status: 404, description: 'Requête introuvable' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequeteResponseDto> {
    return this.requeteService.findOne(id, user);
  }

  // ── PATCH /api/v1/requetes/:id/cloturer ──────────────────────────────────

  @Patch(':id/cloturer')
  @Roles('TECHNICIEN', 'RESPONSABLE_IT', 'ADMIN')
  @ApiOperation({ summary: 'Clôturer une requête' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: RequeteResponseDto })
  @ApiResponse({ status: 403, description: 'Technicien d’un autre sous-service' })
  @ApiResponse({ status: 404, description: 'Requête introuvable' })
  @ApiResponse({ status: 409, description: 'Requête déjà clôturée' })
  cloturer(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequeteResponseDto> {
    return this.requeteService.cloturer(id, user);
  }
}
