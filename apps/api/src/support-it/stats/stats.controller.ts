import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { ListSyntheseQueryDto } from './dto/list-synthese-query.dto';
import { SyntheseMensuelleResponseDto } from './dto/synthese-mensuelle.response.dto';
import { StatsService } from './stats.service';

@ApiTags('Support IT — Statistiques')
@ApiBearerAuth('JWT')
@Roles('RESPONSABLE_IT', 'ADMIN')
@Controller({ path: 'support-it/stats', version: '1' })
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  // ── GET /api/v1/support-it/stats/synthese-mensuelle ──────────────────────

  @Get('synthese-mensuelle')
  @ApiOperation({
    summary: 'Synthèse mensuelle du volume/type de requêtes par sous-service',
    description: 'Agrégat à la demande (pas un job poussé) — défaut : mois en cours.',
  })
  @ApiResponse({ status: 200, type: SyntheseMensuelleResponseDto })
  syntheseMensuelle(@Query() query: ListSyntheseQueryDto): Promise<SyntheseMensuelleResponseDto> {
    return this.statsService.syntheseMensuelle(query);
  }
}
