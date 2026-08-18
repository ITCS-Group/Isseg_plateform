import { ApiPropertyOptional } from '@nestjs/swagger';
import { TypeEpreuve } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class ListEpreuveQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrer par UUID de CoursClasse' })
  @IsOptional()
  @IsUUID('4')
  coursClasseId?: string;

  @ApiPropertyOptional({ enum: TypeEpreuve, description: 'Filtrer par type d’épreuve' })
  @IsOptional()
  @IsEnum(TypeEpreuve)
  type?: TypeEpreuve;
}
