import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class RegularityStatusResponseDto {
  @ApiProperty({ description: 'Étudiant régulier (frais de scolarité soldés) ou non' })
  isRegular: boolean;

  @ApiPropertyOptional({ description: 'Motif si non régulier', nullable: true })
  reason?: string;

  @ApiPropertyOptional({ description: 'Date de la dernière transaction complétée', nullable: true })
  lastPaymentDate?: Date;
}
