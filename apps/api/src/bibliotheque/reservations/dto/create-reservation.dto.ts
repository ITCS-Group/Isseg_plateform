import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  ouvrageId: string;
}
