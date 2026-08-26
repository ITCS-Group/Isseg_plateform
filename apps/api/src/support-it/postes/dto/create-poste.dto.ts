import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreatePosteDto {
  @ApiProperty({ description: 'Salle où se trouve le poste' })
  @IsString()
  @MinLength(1)
  salle: string;
}
