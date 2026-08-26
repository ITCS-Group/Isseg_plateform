import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatutPoste } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ListPosteQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  salle?: string;

  @ApiPropertyOptional({ enum: StatutPoste })
  @IsOptional()
  @IsEnum(StatutPoste)
  statut?: StatutPoste;
}
