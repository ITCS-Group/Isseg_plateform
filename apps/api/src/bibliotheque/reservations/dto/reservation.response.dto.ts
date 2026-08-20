import { ApiProperty } from '@nestjs/swagger';
import { StatutReservation } from '@prisma/client';

export class ReservationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  ouvrageId: string;

  @ApiProperty()
  ouvrageTitre: string;

  @ApiProperty({ format: 'uuid' })
  abonneId: string;

  @ApiProperty()
  dateReservation: Date;

  @ApiProperty({ enum: StatutReservation })
  statut: StatutReservation;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
