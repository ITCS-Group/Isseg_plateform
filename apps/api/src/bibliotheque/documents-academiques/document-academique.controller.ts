import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import { CreateDocumentAcademiqueDto } from './dto/create-document-academique.dto';
import { DocumentAcademiqueResponseDto } from './dto/document-academique.response.dto';
import { ListDocumentAcademiqueQueryDto } from './dto/list-document-academique-query.dto';
import { UpdateDocumentAcademiqueDto } from './dto/update-document-academique.dto';
import { DocumentAcademiqueService } from './document-academique.service';

const MANAGE_ROLES = ['ADMIN', 'RESPONSABLE_NUMERISATION'];

@ApiTags('Bibliothèque — Documents académiques')
@ApiBearerAuth('JWT')
@Roles(...MANAGE_ROLES, 'ETUDIANT', 'ENSEIGNANT')
@Controller({ path: 'documents-academiques', version: '1' })
export class DocumentAcademiqueController {
  constructor(private readonly documentAcademiqueService: DocumentAcademiqueService) {}

  // ── GET /api/v1/documents-academiques ─────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'Lister les thèses/mémoires',
    description:
      'ETUDIANT/ENSEIGNANT ne voient que les documents à diffusion autorisée et hors embargo.',
  })
  @ApiResponse({ status: 200, type: [DocumentAcademiqueResponseDto] })
  findAll(
    @Query() query: ListDocumentAcademiqueQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentAcademiqueResponseDto[]> {
    return this.documentAcademiqueService.findAll(query, user);
  }

  // ── POST /api/v1/documents-academiques ────────────────────────────────────

  @Post()
  @Roles(...MANAGE_ROLES)
  @ApiOperation({ summary: 'Cataloguer un document académique numérisé' })
  @ApiBody({ type: CreateDocumentAcademiqueDto })
  @ApiResponse({ status: 201, type: DocumentAcademiqueResponseDto })
  @ApiResponse({ status: 404, description: 'Etudiant auteur ou Enseignant directeur introuvable' })
  create(@Body() dto: CreateDocumentAcademiqueDto): Promise<DocumentAcademiqueResponseDto> {
    return this.documentAcademiqueService.create(dto);
  }

  // ── GET /api/v1/documents-academiques/:id ─────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un document académique par UUID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: DocumentAcademiqueResponseDto })
  @ApiResponse({ status: 404, description: 'Document introuvable (ou non visible pour cet appelant)' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentAcademiqueResponseDto> {
    return this.documentAcademiqueService.findOne(id, user);
  }

  // ── PATCH /api/v1/documents-academiques/:id ───────────────────────────────

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  @ApiOperation({ summary: 'Modifier un document académique' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateDocumentAcademiqueDto })
  @ApiResponse({ status: 200, type: DocumentAcademiqueResponseDto })
  @ApiResponse({ status: 404, description: 'Document ou Enseignant directeur introuvable' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDocumentAcademiqueDto,
  ): Promise<DocumentAcademiqueResponseDto> {
    return this.documentAcademiqueService.update(id, dto);
  }
}
