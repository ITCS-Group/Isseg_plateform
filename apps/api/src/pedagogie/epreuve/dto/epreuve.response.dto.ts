import { ApiProperty } from '@nestjs/swagger';
import { TypeEpreuve } from '@prisma/client';

export class EpreuveResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', description: 'UUID du CoursClasse concerné' })
  coursClasseId: string;

  @ApiProperty({ enum: TypeEpreuve })
  type: TypeEpreuve;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
