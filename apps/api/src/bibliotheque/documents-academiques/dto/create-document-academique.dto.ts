import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateDocumentAcademiqueDto {
  @ApiProperty({ enum: TypeDocumentAcademique })
  @IsEnum(TypeDocumentAcademique)
  type: TypeDocumentAcademique;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  titre: string;

  @ApiProperty()
  @IsString()
  anneeUniversitaire: string;

  @ApiProperty()
  @IsString()
  filiere: string;

  @ApiProperty()
  @IsString()
  niveau: string;

  @ApiProperty()
  @IsString()
  urlPdf: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  motsCles: string[];

  @ApiProperty()
  @IsString()
  @MinLength(1)
  resume: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  diffusionAutorisee?: boolean;

  @ApiPropertyOptional({ description: 'Date ISO — embargo tant que cette date n’est pas atteinte' })
  @IsOptional()
  @IsDateString()
  embargoJusqua?: string;

  @ApiProperty({ format: 'uuid', description: 'UUID de l’Etudiant auteur' })
  @IsUUID('4')
  auteurId: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'UUID de l’Enseignant directeur de mémoire' })
  @IsOptional()
  @IsUUID('4')
  directeurMemoireId?: string;
}
