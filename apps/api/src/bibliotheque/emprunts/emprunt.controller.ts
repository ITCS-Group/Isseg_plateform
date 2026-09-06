import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import { CreateEmpruntDto } from './dto/create-emprunt.dto';
import { EmpruntResponseDto, PaginatedEmpruntResponseDto } from './dto/emprunt.response.dto';
import { ListEmpruntQueryDto } from './dto/list-emprunt-query.dto';
import { EmpruntService } from './emprunt.service';

const MANAGE_ROLES = ['ADMIN', 'BIBLIOTHECAIRE', 'RESPONSABLE_BIBLIOTHEQUE'];

@ApiTags('Bibliothèque — Emprunts')
@ApiBearerAuth('JWT')
@Roles(...MANAGE_ROLES, 'ETUDIANT', 'ENSEIGNANT')
@Controller({ path: 'emprunts', version: '1' })
export class EmpruntController {
  constructor(private readonly empruntService: EmpruntService) {}

  // ── GET /api/v1/emprunts ──────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'Lister les emprunts',
    description:
      "Un appelant ETUDIANT/ENSEIGNANT ne voit que ses propres emprunts, quel que soit le " +
      "filtre `emprunteurId` fourni (ignoré et remplacé par son propre id).",
  })
  @ApiResponse({ status: 200, type: PaginatedEmpruntResponseDto })
  findAll(
    @Query() query: ListEmpruntQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedEmpruntResponseDto> {
    return this.empruntService.findAll(query, user);
  }

  // ── POST /api/v1/emprunts ─────────────────────────────────────────────────

  @Post()
  @Roles(...MANAGE_ROLES)
  @ApiOperation({ summary: 'Créer un emprunt (vérifie disponibilité, quota et régularité étudiant)' })
  @ApiBody({ type: CreateEmpruntDto })
  @ApiResponse({ status: 201, type: EmpruntResponseDto })
  @ApiResponse({ status: 404, description: 'Ouvrage ou profil abonné introuvable' })
  @ApiResponse({ status: 409, description: 'Aucun exemplaire disponible ou quota atteint' })
  @ApiResponse({ status: 403, description: 'Étudiant non régulier ou abonnement inactif' })
  create(@Body() dto: CreateEmpruntDto): Promise<EmpruntResponseDto> {
    return this.empruntService.create(dto);
  }

  // ── PATCH /api/v1/emprunts/:id/retour ─────────────────────────────────────

  @Patch(':id/retour')
  @Roles(...MANAGE_ROLES)
  @ApiOperation({ summary: 'Enregistrer le retour d’un emprunt' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: EmpruntResponseDto })
  @ApiResponse({ status: 404, description: 'Emprunt introuvable' })
  @ApiResponse({ status: 409, description: 'Emprunt déjà retourné' })
  retour(@Param('id', ParseUUIDPipe) id: string): Promise<EmpruntResponseDto> {
    return this.empruntService.retour(id);
  }
}
