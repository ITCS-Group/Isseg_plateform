import { Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InscriptionCoursSupportITResponseDto } from './dto/inscription.response.dto';
import { InscriptionCoursSupportITService } from './inscription.service';

@ApiTags('Support IT — Inscriptions')
@ApiBearerAuth('JWT')
@Controller({ path: 'cours-support-it/:coursId/inscriptions', version: '1' })
export class InscriptionEnrollmentController {
  constructor(private readonly inscriptionService: InscriptionCoursSupportITService) {}

  @Post()
  @ApiOperation({ summary: 'S’inscrire à un cours Support IT (auto-inscription)' })
  @ApiParam({ name: 'coursId', format: 'uuid' })
  @ApiResponse({ status: 201, type: InscriptionCoursSupportITResponseDto })
  @ApiResponse({ status: 404, description: 'Cours introuvable' })
  @ApiResponse({ status: 409, description: 'Déjà inscrit à ce cours' })
  enroll(
    @Param('coursId', ParseUUIDPipe) coursId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InscriptionCoursSupportITResponseDto> {
    return this.inscriptionService.enroll(coursId, user.id);
  }
}
