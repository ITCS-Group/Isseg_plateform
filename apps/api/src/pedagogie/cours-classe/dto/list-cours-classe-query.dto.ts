import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListCoursClasseQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrer par UUID de CoursScenarise' })
  @IsOptional()
  @IsUUID('4')
  coursId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrer par UUID de Classe' })
  @IsOptional()
  @IsUUID('4')
  classeId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "Filtrer par UUID d'Enseignant (Enseignant.id). Ignoré et remplacé par l'enseignant " +
      "courant si l'appelant a le rôle ENSEIGNANT (ne permet jamais de consulter les cours " +
      "d'un autre enseignant).",
  })
  @IsOptional()
  @IsUUID('4')
  enseignantId?: string;
}
