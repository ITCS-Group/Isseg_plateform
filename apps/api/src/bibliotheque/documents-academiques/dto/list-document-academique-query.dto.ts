import { ApiPropertyOptional } from '@nestjs/swagger';
import { TypeDocumentAcademique } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ListDocumentAcademiqueQueryDto {
  @ApiPropertyOptional({ enum: TypeDocumentAcademique })
  @IsOptional()
  @IsEnum(TypeDocumentAcademique)
  type?: TypeDocumentAcademique;

  @ApiPropertyOptional({ description: 'Recherche libre sur titre/mots-clés' })
  @IsOptional()
  @IsString()
  q?: string;
}
