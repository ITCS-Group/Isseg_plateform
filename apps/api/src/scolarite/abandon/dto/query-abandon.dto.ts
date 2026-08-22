import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatutAbandon } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryAbandonDto extends PaginationDto {
  @ApiPropertyOptional({ enum: StatutAbandon, description: 'Filtrer par statut' })
  @IsOptional()
  @IsEnum(StatutAbandon)
  statut?: StatutAbandon;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrer par UUID d\'étudiant' })
  @IsOptional()
  @IsUUID()
  etudiantId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrer par UUID d\'année universitaire' })
  @IsOptional()
  @IsUUID()
  anneeId?: string;
}
