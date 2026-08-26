import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  destinataireIds: string[];

  @ApiProperty()
  @IsString()
  @MinLength(1)
  contenu: string;
}
