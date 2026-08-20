import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateOuvrageDto {
  @ApiPropertyOptional({ description: 'ISBN (optionnel, unique si fourni)' })
  @IsOptional()
  @IsString()
  isbn?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  titre: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  auteur: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  editeur: string;

  @ApiProperty()
  @IsInt()
  @Min(1000)
  anneeEdition: number;

  @ApiProperty({ description: 'Cote de rangement, unique' })
  @IsString()
  @MinLength(1)
  cote: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classificationDewey?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  matieres: string[];

  @ApiProperty()
  @IsString()
  @MinLength(1)
  salle: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  etagere: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  nombreExemplaires: number;

  @ApiProperty({ format: 'uuid', description: 'UUID de la SectionBibliotheque' })
  @IsUUID('4')
  sectionId: string;
}
