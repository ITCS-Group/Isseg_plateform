import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatutOuvrage } from '@prisma/client';
import { PaginationMetaDto } from '../../../common/dto/pagination.dto';

export class OuvrageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ nullable: true })
  isbn: string | null;

  @ApiProperty()
  titre: string;

  @ApiProperty()
  auteur: string;

  @ApiProperty()
  editeur: string;

  @ApiProperty()
  anneeEdition: number;

  @ApiProperty()
  cote: string;

  @ApiPropertyOptional({ nullable: true })
  classificationDewey: string | null;

  @ApiProperty({ type: [String] })
  matieres: string[];

  @ApiProperty()
  salle: string;

  @ApiProperty()
  etagere: string;

  @ApiProperty()
  nombreExemplaires: number;

  @ApiProperty()
  exemplairesDisponibles: number;

  @ApiProperty({ enum: StatutOuvrage })
  statut: StatutOuvrage;

  @ApiProperty({ format: 'uuid' })
  sectionId: string;

  @ApiProperty()
  sectionNom: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedOuvrageResponseDto {
  @ApiProperty({ type: [OuvrageResponseDto] })
  data: OuvrageResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
