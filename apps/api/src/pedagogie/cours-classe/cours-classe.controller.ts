import {
  Body,
  Controller,
  Delete,
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
import { Roles } from '../../common/decorators/roles.decorator';
import { CoursClasseService } from './cours-classe.service';
import { CreateCoursClasseDto } from './dto/create-cours-classe.dto';
import { ListCoursClasseQueryDto } from './dto/list-cours-classe-query.dto';
import { CoursClasseResponseDto } from './dto/cours-classe.response.dto';

@ApiTags('Pédagogie — Cours/Classe')
@ApiBearerAuth('JWT')
@Roles('ADMIN')
@Controller({ path: 'cours-classes', version: '1' })
export class CoursClasseController {
  constructor(private readonly coursClasseService: CoursClasseService) {}

  // ── GET /api/v1/cours-classes ────────────────────────────────────────────

  @Get()
  @Roles('ADMIN', 'RESPONSABLE_PEDAGOGIQUE', 'CHEF_DEPARTEMENT', 'ENSEIGNANT')
  @ApiOperation({ summary: 'Lister les associations CoursClasse, filtrables par cours et/ou classe' })
  @ApiResponse({ status: 200, type: [CoursClasseResponseDto] })
  findAll(@Query() query: ListCoursClasseQueryDto): Promise<CoursClasseResponseDto[]> {
    return this.coursClasseService.findAll(query);
  }

  // ── POST /api/v1/cours-classes ───────────────────────────────────────────

  @Post()
  @Roles('ADMIN', 'RESPONSABLE_PEDAGOGIQUE')
  @ApiOperation({ summary: 'Créer une association CoursClasse' })
  @ApiBody({ type: CreateCoursClasseDto })
  @ApiResponse({ status: 201, type: CoursClasseResponseDto })
  @ApiResponse({ status: 404, description: 'Cours ou classe introuvable' })
  @ApiResponse({ status: 409, description: 'Cours non approuvé, ou association déjà existante' })
  create(@Body() dto: CreateCoursClasseDto): Promise<CoursClasseResponseDto> {
    return this.coursClasseService.create(dto);
  }

  // ── GET /api/v1/cours-classes/:id ────────────────────────────────────────

  @Get(':id')
  @Roles('ADMIN', 'RESPONSABLE_PEDAGOGIQUE', 'CHEF_DEPARTEMENT', 'ENSEIGNANT')
  @ApiOperation({ summary: 'Récupérer une association CoursClasse par UUID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: CoursClasseResponseDto })
  @ApiResponse({ status: 404, description: 'Association introuvable' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<CoursClasseResponseDto> {
    return this.coursClasseService.findOne(id);
  }

  // ── DELETE /api/v1/cours-classes/:id ─────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer une association CoursClasse',
    description: 'Échoue si des épreuves sont encore rattachées à cette association.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Association supprimée' })
  @ApiResponse({ status: 404, description: 'Association introuvable' })
  @ApiResponse({ status: 409, description: 'Épreuves encore rattachées à cette association' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.coursClasseService.remove(id);
  }
}
