import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RegularityService } from './regularity.service';
import { RegularityStatusResponseDto } from './dto/regularity-status.response.dto';

/**
 * Producteur du contrat inter-modules "statut de régularité" (cf. CLAUDE.md
 * § Scolarité ↔ Bibliothèque). Exposé en HTTP pour les appelants externes
 * / documentation Swagger ; les modules internes au même monolithe (ex.
 * Bibliothèque) doivent injecter RegularityService directement plutôt que
 * de passer par cette route.
 */
@ApiTags('Régularité')
@ApiBearerAuth('JWT')
@Roles('ADMIN', 'SCOLARITE', 'BIBLIOTHECAIRE')
@Controller({ path: 'students', version: '1' })
export class RegularityController {
  constructor(private readonly regularityService: RegularityService) {}

  // ── GET /api/v1/students/:matricule/regularity-status ───────────────────

  @Get(':matricule/regularity-status')
  @ApiOperation({
    summary: "Vérifier la régularité (frais de scolarité) d'un étudiant",
  })
  @ApiParam({ name: 'matricule', description: 'Matricule ISSEG de l’étudiant' })
  @ApiResponse({ status: 200, type: RegularityStatusResponseDto })
  @ApiResponse({ status: 404, description: 'Étudiant introuvable' })
  getRegularityStatus(
    @Param('matricule') matricule: string,
  ): Promise<RegularityStatusResponseDto> {
    return this.regularityService.checkRegularity(matricule);
  }
}
