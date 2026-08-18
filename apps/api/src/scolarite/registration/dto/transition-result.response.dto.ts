import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatutDossier } from '@prisma/client';

/**
 * Représentation HTTP du résultat d'une transition réussie (schéma Swagger).
 * Miroir 1:1 de `TransitionResult` (registration.types.ts) — aucune logique.
 */
export class TransitionResultResponseDto {
  @ApiProperty({ format: 'uuid', description: 'UUID du dossier d\'inscription' })
  dossierId: string;

  @ApiProperty({ enum: StatutDossier, description: 'Statut avant la transition' })
  fromStatus: StatutDossier;

  @ApiProperty({ enum: StatutDossier, description: 'Statut après la transition' })
  toStatus: StatutDossier;

  @ApiProperty({ description: 'Version du dossier après incrément (optimistic locking)', example: 2 })
  version: number;

  @ApiPropertyOptional({
    description: 'Matricule attribué/conservé, uniquement lors du passage à INSCRIT',
    example: 'ISSEG-2026-0001',
    nullable: true,
  })
  matricule?: string;
}
