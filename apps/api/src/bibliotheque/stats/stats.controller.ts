import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { BibliothequeStatsResponseDto } from './dto/bibliotheque-stats.response.dto';
import { StatsService } from './stats.service';

@ApiTags('Bibliothèque — Statistiques')
@ApiBearerAuth('JWT')
@Roles('ADMIN', 'BIBLIOTHECAIRE', 'RESPONSABLE_BIBLIOTHEQUE')
@Controller({ path: 'bibliotheque/stats', version: '1' })
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  // ── GET /api/v1/bibliotheque/stats/dashboard ──────────────────────────────

  @Get('dashboard')
  @ApiOperation({ summary: 'Tableau de bord Bibliothèque (compteurs agrégés)' })
  @ApiResponse({ status: 200, type: BibliothequeStatsResponseDto })
  dashboard(): Promise<BibliothequeStatsResponseDto> {
    return this.statsService.dashboard();
  }
}
