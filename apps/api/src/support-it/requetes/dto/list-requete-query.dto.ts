import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatutRequete } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListRequeteQueryDto {
  @ApiPropertyOptional({ enum: StatutRequete })
  @IsOptional()
  @IsEnum(StatutRequete)
  statut?: StatutRequete;
}
