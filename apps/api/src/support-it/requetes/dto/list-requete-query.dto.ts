import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatutRequete } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListRequeteQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: StatutRequete })
  @IsOptional()
  @IsEnum(StatutRequete)
  statut?: StatutRequete;
}
