import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TypeAbonne } from '@prisma/client';
import { PaginationMetaDto } from '../../../common/dto/pagination.dto';

export class AbonneResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  utilisateurId: string;

  @ApiProperty()
  utilisateurNom: string;

  @ApiProperty()
  utilisateurPrenom: string;

  @ApiProperty({ enum: TypeAbonne })
  typeAbonne: TypeAbonne;

  @ApiProperty()
  dateDebut: Date;

  @ApiPropertyOptional({ nullable: true })
  dateFin: Date | null;

  @ApiProperty()
  statutActif: boolean;

  @ApiProperty()
  limiteEmprunts: number;

  @ApiProperty()
  dureePretJours: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedAbonneResponseDto {
  @ApiProperty({ type: [AbonneResponseDto] })
  data: AbonneResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
