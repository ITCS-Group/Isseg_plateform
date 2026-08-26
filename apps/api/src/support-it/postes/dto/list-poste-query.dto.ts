import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatutPoste } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListPosteQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  salle?: string;

  @ApiPropertyOptional({ enum: StatutPoste })
  @IsOptional()
  @IsEnum(StatutPoste)
  statut?: StatutPoste;
}
