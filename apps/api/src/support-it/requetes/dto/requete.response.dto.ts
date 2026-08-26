import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NatureRequete, SousServiceIT, StatutRequete } from '@prisma/client';

export class RequeteResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  demandeurId: string;

  @ApiProperty()
  demandeurNom: string;

  @ApiProperty()
  demandeurPrenom: string;

  @ApiProperty({ enum: NatureRequete })
  nature: NatureRequete;

  @ApiProperty({ enum: SousServiceIT })
  sousServiceCible: SousServiceIT;

  @ApiProperty()
  description: string;

  @ApiProperty({ enum: StatutRequete })
  statut: StatutRequete;

  @ApiProperty()
  dateOuverture: Date;

  @ApiPropertyOptional({ nullable: true })
  dateCloture: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
