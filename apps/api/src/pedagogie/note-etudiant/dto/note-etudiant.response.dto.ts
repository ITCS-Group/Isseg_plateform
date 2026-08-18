import { ApiProperty } from '@nestjs/swagger';

export class NoteEtudiantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', description: 'UUID de l’Epreuve concernée' })
  epreuveId: string;

  @ApiProperty({ format: 'uuid', description: 'UUID de l’Inscription concernée' })
  inscriptionId: string;

  @ApiProperty({ description: 'Note brute' })
  noteBrute: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
