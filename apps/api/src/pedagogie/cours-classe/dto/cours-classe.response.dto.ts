import { ApiProperty } from '@nestjs/swagger';

export class CoursClasseResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', description: 'UUID du CoursScenarise associé' })
  coursId: string;

  @ApiProperty({ format: 'uuid', description: 'UUID de la Classe associée' })
  classeId: string;

  @ApiProperty()
  createdAt: Date;
}
