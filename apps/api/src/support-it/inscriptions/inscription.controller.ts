import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateEvaluationSupportITDto } from './dto/create-evaluation.dto';
import { EvaluationSupportITResponseDto } from './dto/evaluation.response.dto';
import {
  InscriptionCoursSupportITResponseDto,
  PaginatedInscriptionCoursSupportITResponseDto,
} from './dto/inscription.response.dto';
import { ListInscriptionQueryDto } from './dto/list-inscription-query.dto';
import { InscriptionCoursSupportITService } from './inscription.service';

@ApiTags('Support IT — Inscriptions')
@ApiBearerAuth('JWT')
@Controller({ path: 'inscriptions-support-it', version: '1' })
export class InscriptionController {
  constructor(private readonly inscriptionService: InscriptionCoursSupportITService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister les inscriptions',
    description: 'Un participant ne voit que ses propres inscriptions. RESPONSABLE_IT/ADMIN voient tout.',
  })
  @ApiResponse({ status: 200, type: PaginatedInscriptionCoursSupportITResponseDto })
  findAll(
    @Query() query: ListInscriptionQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedInscriptionCoursSupportITResponseDto> {
    return this.inscriptionService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’une inscription' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: InscriptionCoursSupportITResponseDto })
  @ApiResponse({ status: 403, description: 'Inscription hors du périmètre de l’appelant' })
  @ApiResponse({ status: 404, description: 'Inscription introuvable' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InscriptionCoursSupportITResponseDto> {
    return this.inscriptionService.findOne(id, user);
  }

  @Post(':id/evaluation')
  @Roles('RESPONSABLE_IT', 'ADMIN')
  @ApiOperation({
    summary: 'Saisir la note d’évaluation',
    description:
      'Saisie manuelle par RESPONSABLE_IT (pas d’auto-calcul). Déclenche l’attestation provisoire ' +
      'si statutReussite = true (voir AttestationService).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: CreateEvaluationSupportITDto })
  @ApiResponse({ status: 201, type: EvaluationSupportITResponseDto })
  @ApiResponse({ status: 404, description: 'Inscription introuvable' })
  @ApiResponse({ status: 409, description: 'Inscription déjà évaluée' })
  evaluer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEvaluationSupportITDto,
  ): Promise<EvaluationSupportITResponseDto> {
    return this.inscriptionService.evaluer(id, dto);
  }
}
