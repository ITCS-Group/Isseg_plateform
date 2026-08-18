import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsUUID } from 'class-validator';

export class CreateNoteEtudiantDto {
  @ApiProperty({ format: 'uuid', description: 'UUID de l’Epreuve concernée' })
  @IsUUID('4')
  epreuveId: string;

  @ApiProperty({ format: 'uuid', description: 'UUID de l’Inscription concernée' })
  @IsUUID('4')
  inscriptionId: string;

  @ApiProperty({ description: 'Note brute saisie', example: 14.5 })
  @Type(() => Number)
  @IsNumber()
  noteBrute: number;
}
