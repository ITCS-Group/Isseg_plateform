import { ApiProperty } from '@nestjs/swagger';

export class BibliothequeStatsResponseDto {
  @ApiProperty()
  totalOuvrages: number;

  @ApiProperty()
  totalExemplaires: number;

  @ApiProperty()
  exemplairesDisponibles: number;

  @ApiProperty()
  empruntsEnCours: number;

  @ApiProperty()
  empruntsEnRetard: number;

  @ApiProperty()
  reservationsEnAttente: number;

  @ApiProperty()
  totalAbonnes: number;

  @ApiProperty()
  totalDocumentsAcademiques: number;
}
