import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateInterventionDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  compteRendu: string;
}
