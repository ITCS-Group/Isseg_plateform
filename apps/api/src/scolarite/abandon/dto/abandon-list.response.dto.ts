import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination.dto';
import { AbandonResponseDto } from './abandon.response.dto';

export class AbandonListResponseDto {
  @ApiProperty({ type: [AbandonResponseDto] })
  data: AbandonResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
