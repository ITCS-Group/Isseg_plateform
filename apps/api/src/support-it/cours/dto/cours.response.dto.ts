import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination.dto';

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

export class PaginatedCoursSupportITResponseDto {
  @ApiProperty({ type: [CoursSupportITResponseDto] })
  data: CoursSupportITResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
