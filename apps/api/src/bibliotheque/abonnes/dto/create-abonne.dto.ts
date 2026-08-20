import { ApiProperty } from '@nestjs/swagger';
import { TypeAbonne } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class CreateAbonneDto {
  @ApiProperty({ format: 'uuid', description: 'UUID de l’Utilisateur à abonner' })
  @IsUUID('4')
  utilisateurId: string;

  @ApiProperty({ enum: TypeAbonne })
  @IsEnum(TypeAbonne)
  typeAbonne: TypeAbonne;
}
