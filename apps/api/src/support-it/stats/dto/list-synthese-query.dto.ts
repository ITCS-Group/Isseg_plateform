import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class ListSyntheseQueryDto {
  @ApiPropertyOptional({
    example: '2026-08',
    description: 'Mois au format YYYY-MM — défaut : mois en cours',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'mois doit être au format YYYY-MM' })
  mois?: string;
}
