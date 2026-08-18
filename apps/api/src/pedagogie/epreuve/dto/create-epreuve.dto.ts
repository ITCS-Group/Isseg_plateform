import { ApiProperty } from '@nestjs/swagger';
import { TypeEpreuve } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class CreateEpreuveDto {
  @ApiProperty({ format: 'uuid', description: 'UUID du CoursClasse concerné' })
  @IsUUID('4')
  coursClasseId: string;

  @ApiProperty({ enum: TypeEpreuve, description: 'Type de l’épreuve' })
  @IsEnum(TypeEpreuve)
  type: TypeEpreuve;
}
