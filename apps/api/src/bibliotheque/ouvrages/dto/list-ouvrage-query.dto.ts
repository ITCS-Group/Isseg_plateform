import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatutOuvrage } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListOuvrageQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Recherche libre sur titre/auteur' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrer par section' })
  @IsOptional()
  @IsUUID('4')
  sectionId?: string;

  @ApiPropertyOptional({ enum: StatutOuvrage })
  @IsOptional()
  @IsEnum(StatutOuvrage)
  statut?: StatutOuvrage;
}
