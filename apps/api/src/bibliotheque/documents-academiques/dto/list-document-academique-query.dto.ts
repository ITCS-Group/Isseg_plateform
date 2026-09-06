import { ApiPropertyOptional } from '@nestjs/swagger';
import { TypeDocumentAcademique } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListDocumentAcademiqueQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TypeDocumentAcademique })
  @IsOptional()
  @IsEnum(TypeDocumentAcademique)
  type?: TypeDocumentAcademique;

  @ApiPropertyOptional({ description: 'Recherche libre sur titre/mots-clés' })
  @IsOptional()
  @IsString()
  q?: string;
}
