import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListNoteEtudiantQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrer par UUID d’Epreuve' })
  @IsOptional()
  @IsUUID('4')
  epreuveId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrer par UUID d’Inscription' })
  @IsOptional()
  @IsUUID('4')
  inscriptionId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "Filtrer par UUID d'Enseignant (Enseignant.id). Ignoré et remplacé par l'enseignant " +
      "courant si l'appelant a le rôle ENSEIGNANT (ne permet jamais de consulter les notes " +
      "des cours d'un autre enseignant).",
  })
  @IsOptional()
  @IsUUID('4')
  enseignantId?: string;
}
