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
import { EpreuveService } from './epreuve.service';
import { CreateEpreuveDto } from './dto/create-epreuve.dto';
import { ListEpreuveQueryDto } from './dto/list-epreuve-query.dto';
import { EpreuveResponseDto } from './dto/epreuve.response.dto';

@ApiTags('Pédagogie — Épreuves')
@ApiBearerAuth('JWT')
@Roles('ADMIN')
@Controller({ path: 'epreuves', version: '1' })
export class EpreuveController {
  constructor(private readonly epreuveService: EpreuveService) {}

  // ── GET /api/v1/epreuves ─────────────────────────────────────────────────

  @Get()
  @Roles('ADMIN', 'RESPONSABLE_PEDAGOGIQUE', 'CHEF_DEPARTEMENT', 'ENSEIGNANT')
  @ApiOperation({ summary: 'Lister les épreuves, filtrables par cours/classe et/ou type' })
  @ApiResponse({ status: 200, type: [EpreuveResponseDto] })
  findAll(@Query() query: ListEpreuveQueryDto): Promise<EpreuveResponseDto[]> {
    return this.epreuveService.findAll(query);
  }

  // ── POST /api/v1/epreuves ────────────────────────────────────────────────

  @Post()
  @Roles('ADMIN', 'RESPONSABLE_PEDAGOGIQUE', 'ENSEIGNANT')
  @ApiOperation({ summary: 'Créer une épreuve pour un CoursClasse' })
  @ApiBody({ type: CreateEpreuveDto })
  @ApiResponse({ status: 201, type: EpreuveResponseDto })
  @ApiResponse({ status: 404, description: 'CoursClasse introuvable' })
  @ApiResponse({ status: 409, description: 'Cours non approuvé' })
  create(@Body() dto: CreateEpreuveDto): Promise<EpreuveResponseDto> {
    return this.epreuveService.create(dto);
  }

  // ── GET /api/v1/epreuves/:id ─────────────────────────────────────────────

  @Get(':id')
  @Roles('ADMIN', 'RESPONSABLE_PEDAGOGIQUE', 'CHEF_DEPARTEMENT', 'ENSEIGNANT')
  @ApiOperation({ summary: 'Récupérer une épreuve par UUID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: EpreuveResponseDto })
  @ApiResponse({ status: 404, description: 'Épreuve introuvable' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<EpreuveResponseDto> {
    return this.epreuveService.findOne(id);
  }

  // ── DELETE /api/v1/epreuves/:id ──────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer une épreuve',
    description: 'Échoue si des notes étudiant sont encore rattachées à cette épreuve.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Épreuve supprimée' })
  @ApiResponse({ status: 404, description: 'Épreuve introuvable' })
  @ApiResponse({ status: 409, description: 'Notes encore rattachées à cette épreuve' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.epreuveService.remove(id);
  }
}
