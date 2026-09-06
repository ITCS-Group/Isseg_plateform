import { ApiPropertyOptional } from '@nestjs/swagger';
import { TypeEpreuve } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListEpreuveQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrer par UUID de CoursClasse' })
  @IsOptional()
  @IsUUID('4')
  coursClasseId?: string;

  @ApiPropertyOptional({ enum: TypeEpreuve, description: 'Filtrer par type d’épreuve' })
  @IsOptional()
  @IsEnum(TypeEpreuve)
  type?: TypeEpreuve;
}
