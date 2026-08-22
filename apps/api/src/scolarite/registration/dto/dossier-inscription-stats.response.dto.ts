import { ApiProperty } from '@nestjs/swagger';

export class DossierInscriptionStatsResponseDto {
  @ApiProperty({
    example: 2847,
    description: "Nombre de dossiers au statut INSCRIT pour l'année universitaire active (0 si aucune année n'est marquée active)",
  })
  effectifInscrit: number;
}
