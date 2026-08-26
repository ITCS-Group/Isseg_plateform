import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreateCoursSupportITDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  titre: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  contenu: string;

  @ApiProperty({ example: 'Débutant' })
  @IsString()
  @MinLength(2)
  niveau: string;

  @ApiProperty({ description: 'Durée en minutes' })
  @IsInt()
  @Min(1)
  duree: number;
}
