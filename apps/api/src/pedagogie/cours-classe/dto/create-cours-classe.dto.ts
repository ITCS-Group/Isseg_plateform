import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateCoursClasseDto {
  @ApiProperty({ format: 'uuid', description: 'UUID du CoursScenarise à associer' })
  @IsUUID('4')
  coursId: string;

  @ApiProperty({ format: 'uuid', description: 'UUID de la Classe à associer' })
  @IsUUID('4')
  classeId: string;
}
