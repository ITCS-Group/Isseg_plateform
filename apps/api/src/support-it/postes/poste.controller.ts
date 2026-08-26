import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreatePosteDto } from './dto/create-poste.dto';
import { ListPosteQueryDto } from './dto/list-poste-query.dto';
import { DisponibilitePosteDto, PaginatedPosteResponseDto, PosteResponseDto } from './dto/poste.response.dto';
import { UpdatePosteStatutDto } from './dto/update-poste-statut.dto';
import { PosteService } from './poste.service';

@ApiTags('Support IT — Postes')
@ApiBearerAuth('JWT')
@Controller({ path: 'postes', version: '1' })
export class PosteController {
  constructor(private readonly posteService: PosteService) {}

  @Post()
  @Roles('RESPONSABLE_IT', 'ADMIN')
  @ApiOperation({ summary: 'Enregistrer un nouveau poste' })
  @ApiBody({ type: CreatePosteDto })
  @ApiResponse({ status: 201, type: PosteResponseDto })
  create(@Body() dto: CreatePosteDto): Promise<PosteResponseDto> {
    return this.posteService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les postes' })
  @ApiResponse({ status: 200, type: PaginatedPosteResponseDto })
  findAll(@Query() query: ListPosteQueryDto): Promise<PaginatedPosteResponseDto> {
    return this.posteService.findAll(query);
  }

  // Déclaré avant ':id' — sinon Nest matcherait 'stats' comme un :id.
  @Get('stats/disponibilite')
  @ApiOperation({ summary: 'Comptage des postes disponibles/hors service par salle' })
  @ApiResponse({ status: 200, type: [DisponibilitePosteDto] })
  disponibiliteParSalle(): Promise<DisponibilitePosteDto[]> {
    return this.posteService.disponibiliteParSalle();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’un poste' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: PosteResponseDto })
  @ApiResponse({ status: 404, description: 'Poste introuvable' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PosteResponseDto> {
    return this.posteService.findOne(id);
  }

  @Patch(':id/statut')
  @Roles('RESPONSABLE_IT', 'ADMIN', 'TECHNICIEN')
  @ApiOperation({ summary: 'Changer le statut d’un poste (DISPONIBLE/HORS_SERVICE)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdatePosteStatutDto })
  @ApiResponse({ status: 200, type: PosteResponseDto })
  @ApiResponse({ status: 404, description: 'Poste introuvable' })
  updateStatut(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePosteStatutDto,
  ): Promise<PosteResponseDto> {
    return this.posteService.updateStatut(id, dto);
  }
}
