import { ApiPropertyOptional } from '@nestjs/swagger';
import { TypeDocumentAcademique } from '@prisma/client';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class UpdateDocumentAcademiqueDto {
  @ApiPropertyOptional({ enum: TypeDocumentAcademique })
  @IsOptional()
  @IsEnum(TypeDocumentAcademique)
  type?: TypeDocumentAcademique;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  titre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resume?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  motsCles?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  diffusionAutorisee?: boolean;

  @ApiPropertyOptional({ description: 'Date ISO' })
  @IsOptional()
  @IsDateString()
  embargoJusqua?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  directeurMemoireId?: string;
}
