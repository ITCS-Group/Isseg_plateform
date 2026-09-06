import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { AbonneService } from './abonne.service';
import { AbonneResponseDto, PaginatedAbonneResponseDto } from './dto/abonne.response.dto';
import { CreateAbonneDto } from './dto/create-abonne.dto';
import { ListAbonneQueryDto } from './dto/list-abonne-query.dto';

const MANAGE_ROLES = ['ADMIN', 'BIBLIOTHECAIRE', 'RESPONSABLE_BIBLIOTHEQUE'];

@ApiTags('Bibliothèque — Abonnés')
@ApiBearerAuth('JWT')
@Roles(...MANAGE_ROLES)
@Controller({ path: 'abonnes', version: '1' })
export class AbonneController {
  constructor(private readonly abonneService: AbonneService) {}

  // ── GET /api/v1/abonnes ───────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Lister les abonnés' })
  @ApiResponse({ status: 200, type: PaginatedAbonneResponseDto })
  findAll(@Query() query: ListAbonneQueryDto): Promise<PaginatedAbonneResponseDto> {
    return this.abonneService.findAll(query);
  }

  // ── POST /api/v1/abonnes ──────────────────────────────────────────────────

  @Post()
  @ApiOperation({
    summary: 'Créer un profil abonné (personnel — les étudiants sont abonnés automatiquement à l’inscription)',
  })
  @ApiBody({ type: CreateAbonneDto })
  @ApiResponse({ status: 201, type: AbonneResponseDto })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  @ApiResponse({ status: 409, description: 'Utilisateur déjà abonné' })
  create(@Body() dto: CreateAbonneDto): Promise<AbonneResponseDto> {
    return this.abonneService.create(dto);
  }
}
