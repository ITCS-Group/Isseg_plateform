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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import { NoteEtudiantService } from './note-etudiant.service';
import { CreateNoteEtudiantDto } from './dto/create-note-etudiant.dto';
import { ListNoteEtudiantQueryDto } from './dto/list-note-etudiant-query.dto';
import { UpdateNoteEtudiantDto } from './dto/update-note-etudiant.dto';
import {
  NoteEtudiantResponseDto,
  PaginatedNoteEtudiantResponseDto,
} from './dto/note-etudiant.response.dto';

@ApiTags('Pédagogie — Notes étudiant')
@ApiBearerAuth('JWT')
@Roles('ADMIN')
@Controller({ path: 'notes-etudiant', version: '1' })
export class NoteEtudiantController {
  constructor(private readonly noteEtudiantService: NoteEtudiantService) {}

  // ── GET /api/v1/notes-etudiant ───────────────────────────────────────────

  @Get()
  @Roles('ADMIN', 'DGA_ETUDES', 'CHEF_DEPARTEMENT', 'ENSEIGNANT')
  @ApiOperation({
    summary: 'Lister les notes, filtrables par épreuve et/ou inscription',
    description:
      "Un appelant ENSEIGNANT ne voit que les notes de ses propres cours, quel que soit le " +
      "filtre `enseignantId` fourni (ignoré et remplacé par son propre id).",
  })
  @ApiResponse({ status: 200, type: PaginatedNoteEtudiantResponseDto })
  findAll(
    @Query() query: ListNoteEtudiantQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedNoteEtudiantResponseDto> {
    return this.noteEtudiantService.findAll(query, user);
  }

  // ── POST /api/v1/notes-etudiant ──────────────────────────────────────────

  @Post()
  @Roles('ADMIN', 'DGA_ETUDES', 'ENSEIGNANT')
  @ApiOperation({ summary: 'Créer une note étudiant pour une épreuve' })
  @ApiBody({ type: CreateNoteEtudiantDto })
  @ApiResponse({ status: 201, type: NoteEtudiantResponseDto })
  @ApiResponse({ status: 404, description: 'Epreuve ou Inscription introuvable' })
  @ApiResponse({ status: 409, description: 'Note déjà existante pour cette épreuve/inscription' })
  @ApiResponse({ status: 403, description: 'Enseignant non titulaire du cours' })
  create(
    @Body() dto: CreateNoteEtudiantDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NoteEtudiantResponseDto> {
    return this.noteEtudiantService.create(dto, user);
  }

  // ── GET /api/v1/notes-etudiant/:id ───────────────────────────────────────

  @Get(':id')
  @Roles('ADMIN', 'DGA_ETUDES', 'CHEF_DEPARTEMENT', 'ENSEIGNANT')
  @ApiOperation({ summary: 'Récupérer une note par UUID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: NoteEtudiantResponseDto })
  @ApiResponse({ status: 404, description: 'Note introuvable' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<NoteEtudiantResponseDto> {
    return this.noteEtudiantService.findOne(id);
  }

  // ── PATCH /api/v1/notes-etudiant/:id ─────────────────────────────────────

  @Patch(':id')
  @Roles('ADMIN', 'DGA_ETUDES', 'ENSEIGNANT')
  @ApiOperation({ summary: 'Modifier la note brute d’une NoteEtudiant' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateNoteEtudiantDto })
  @ApiResponse({ status: 200, type: NoteEtudiantResponseDto })
  @ApiResponse({ status: 404, description: 'Note introuvable' })
  @ApiResponse({ status: 403, description: 'Enseignant non titulaire du cours' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNoteEtudiantDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NoteEtudiantResponseDto> {
    return this.noteEtudiantService.update(id, dto, user);
  }

  // ── DELETE /api/v1/notes-etudiant/:id ────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une note étudiant' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Note supprimée' })
  @ApiResponse({ status: 404, description: 'Note introuvable' })
  @ApiResponse({ status: 409, description: 'Un historique existe pour cette note' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.noteEtudiantService.remove(id);
  }
}
