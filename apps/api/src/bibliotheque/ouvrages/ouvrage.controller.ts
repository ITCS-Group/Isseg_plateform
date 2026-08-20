import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateOuvrageDto } from './dto/create-ouvrage.dto';
import { ListOuvrageQueryDto } from './dto/list-ouvrage-query.dto';
import { OuvrageResponseDto } from './dto/ouvrage.response.dto';
import { UpdateOuvrageDto } from './dto/update-ouvrage.dto';
import { OuvrageService } from './ouvrage.service';

const MANAGE_ROLES = ['ADMIN', 'BIBLIOTHECAIRE', 'RESPONSABLE_BIBLIOTHEQUE'];

@ApiTags('Bibliothèque — Ouvrages')
@ApiBearerAuth('JWT')
@Roles(...MANAGE_ROLES, 'ETUDIANT', 'ENSEIGNANT')
@Controller({ path: 'ouvrages', version: '1' })
export class OuvrageController {
  constructor(private readonly ouvrageService: OuvrageService) {}

  // ── GET /api/v1/ouvrages ──────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Rechercher/lister le catalogue des ouvrages' })
  @ApiResponse({ status: 200, type: [OuvrageResponseDto] })
  findAll(@Query() query: ListOuvrageQueryDto): Promise<OuvrageResponseDto[]> {
    return this.ouvrageService.findAll(query);
  }

  // ── POST /api/v1/ouvrages ─────────────────────────────────────────────────

  @Post()
  @Roles(...MANAGE_ROLES)
  @ApiOperation({ summary: 'Cataloguer un nouvel ouvrage' })
  @ApiBody({ type: CreateOuvrageDto })
  @ApiResponse({ status: 201, type: OuvrageResponseDto })
  @ApiResponse({ status: 404, description: 'SectionBibliotheque introuvable' })
  create(@Body() dto: CreateOuvrageDto): Promise<OuvrageResponseDto> {
    return this.ouvrageService.create(dto);
  }

  // ── GET /api/v1/ouvrages/:id ──────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un ouvrage par UUID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: OuvrageResponseDto })
  @ApiResponse({ status: 404, description: 'Ouvrage introuvable' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<OuvrageResponseDto> {
    return this.ouvrageService.findOne(id);
  }

  // ── PATCH /api/v1/ouvrages/:id ────────────────────────────────────────────

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  @ApiOperation({ summary: 'Modifier un ouvrage' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateOuvrageDto })
  @ApiResponse({ status: 200, type: OuvrageResponseDto })
  @ApiResponse({ status: 404, description: 'Ouvrage ou SectionBibliotheque introuvable' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOuvrageDto,
  ): Promise<OuvrageResponseDto> {
    return this.ouvrageService.update(id, dto);
  }

  // ── DELETE /api/v1/ouvrages/:id ───────────────────────────────────────────

  @Delete(':id')
  @Roles(...MANAGE_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un ouvrage' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Ouvrage supprimé' })
  @ApiResponse({ status: 404, description: 'Ouvrage introuvable' })
  @ApiResponse({ status: 409, description: 'Emprunts en cours sur cet ouvrage' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.ouvrageService.remove(id);
  }
}
