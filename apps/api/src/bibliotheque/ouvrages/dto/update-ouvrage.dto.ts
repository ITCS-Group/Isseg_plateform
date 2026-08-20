import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatutOuvrage } from '@prisma/client';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateOuvrageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  isbn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  titre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  auteur?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  editeur?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1000)
  anneeEdition?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  cote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classificationDewey?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  matieres?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  salle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  etagere?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  nombreExemplaires?: number;

  @ApiPropertyOptional({ enum: StatutOuvrage })
  @IsOptional()
  @IsEnum(StatutOuvrage)
  statut?: StatutOuvrage;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  sectionId?: string;
}
