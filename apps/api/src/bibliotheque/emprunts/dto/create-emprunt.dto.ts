import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateEmpruntDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  ouvrageId: string;

  @ApiProperty({ format: 'uuid', description: 'UUID de l’Utilisateur emprunteur' })
  @IsUUID('4')
  emprunteurId: string;
}
