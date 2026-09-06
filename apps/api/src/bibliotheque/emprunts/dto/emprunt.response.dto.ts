import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatutEmprunt } from '@prisma/client';
import { PaginationMetaDto } from '../../../common/dto/pagination.dto';

export class EmpruntResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  ouvrageId: string;

  @ApiProperty()
  ouvrageTitre: string;

  @ApiProperty({ format: 'uuid' })
  emprunteurId: string;

  @ApiProperty()
  emprunteurNom: string;

  @ApiProperty()
  emprunteurPrenom: string;

  @ApiProperty()
  dateEmprunt: Date;

  @ApiProperty()
  dateRetourPrevue: Date;

  @ApiPropertyOptional({ nullable: true })
  dateRetourEffectif: Date | null;

  @ApiProperty()
  renouvellementsRestants: number;

  @ApiProperty({ enum: StatutEmprunt })
  statut: StatutEmprunt;

  @ApiProperty()
  retardJours: number;

  @ApiProperty()
  montantPenalite: number;

  @ApiProperty()
  penalitesPayees: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedEmpruntResponseDto {
  @ApiProperty({ type: [EmpruntResponseDto] })
  data: EmpruntResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
