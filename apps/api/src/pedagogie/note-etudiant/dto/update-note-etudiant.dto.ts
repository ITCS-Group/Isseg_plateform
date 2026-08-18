import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateNoteEtudiantDto {
  @ApiProperty({ description: 'Nouvelle note brute', example: 15 })
  @Type(() => Number)
  @IsNumber()
  noteBrute: number;

  @ApiPropertyOptional({ description: 'Motif de la modification', example: 'Erreur de saisie corrigée' })
  @IsOptional()
  @IsString()
  motif?: string;
}
