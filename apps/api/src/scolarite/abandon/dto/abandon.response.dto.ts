import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatutAbandon } from '@prisma/client';

/** Représentation HTTP d'un Abandon — miroir 1:1 du modèle Prisma. */
export class AbandonResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  etudiantId: string;

  @ApiProperty({ format: 'uuid' })
  anneeId: string;

  @ApiProperty({ enum: StatutAbandon })
  statut: StatutAbandon;

  @ApiProperty()
  dateConstat: Date;

  @ApiProperty({ format: 'uuid' })
  signaleParId: string;

  @ApiPropertyOptional({ nullable: true })
  dateDemandeReprise: Date | null;

  @ApiPropertyOptional({ nullable: true })
  dateDecisionReprise: Date | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  decideParId: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
