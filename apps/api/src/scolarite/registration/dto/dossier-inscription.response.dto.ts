import { ApiProperty } from '@nestjs/swagger';
import { StatutDossier } from '@prisma/client';
import { PaginationMetaDto } from '../../../common/dto/pagination.dto';

export class DossierInscriptionListItemDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'ISSEG-2026-00123', nullable: true })
  matricule: string | null;

  @ApiProperty({ example: 'Diallo' })
  etudiantNom: string;

  @ApiProperty({ example: 'Fatoumata' })
  etudiantPrenom: string;

  @ApiProperty({ example: "Sciences de l'Éducation" })
  filiere: string;

  @ApiProperty({ example: 'L1-A' })
  classeLibelle: string;

  @ApiProperty({ enum: StatutDossier, example: StatutDossier.INSCRIT })
  statutDossier: StatutDossier;

  @ApiProperty({ nullable: true })
  dateSoumission: Date | null;
}

export class PaginatedDossiersInscriptionResponseDto {
  @ApiProperty({ type: [DossierInscriptionListItemDto] })
  data: DossierInscriptionListItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
