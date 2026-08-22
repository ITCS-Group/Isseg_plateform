import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

/** Décision prise sur une demande de reprise (REPRISE_DEMANDEE → …). */
export enum DecisionReprise {
  ACCORDEE = 'ACCORDEE',
  REFUSEE = 'REFUSEE',
}

/**
 * DTO de la transition REPRISE_DEMANDEE → REPRISE_ACCORDEE | REPRISE_REFUSEE.
 *
 * `decideParId` provient EXCLUSIVEMENT du JWT (jamais du body).
 */
export class DeciderRepriseDto {
  @ApiProperty({ enum: DecisionReprise, description: 'Décision sur la demande de reprise' })
  @IsEnum(DecisionReprise)
  decision: DecisionReprise;
}
