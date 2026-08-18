import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListCoursClasseQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrer par UUID de CoursScenarise' })
  @IsOptional()
  @IsUUID('4')
  coursId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrer par UUID de Classe' })
  @IsOptional()
  @IsUUID('4')
  classeId?: string;
}
