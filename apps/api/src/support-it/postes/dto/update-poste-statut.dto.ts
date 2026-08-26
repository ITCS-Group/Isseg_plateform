import { ApiProperty } from '@nestjs/swagger';
import { StatutPoste } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdatePosteStatutDto {
  @ApiProperty({
    enum: StatutPoste,
    description: 'Passage à DISPONIBLE horodate automatiquement dateDerniereMaintenance',
  })
  @IsEnum(StatutPoste)
  statut: StatutPoste;
}
