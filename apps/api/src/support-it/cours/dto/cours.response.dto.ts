import { ApiProperty } from '@nestjs/swagger';

export class CoursSupportITResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  titre: string;

  @ApiProperty()
  contenu: string;

  @ApiProperty()
  niveau: string;

  @ApiProperty()
  duree: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
