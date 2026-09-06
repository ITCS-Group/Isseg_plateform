import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination.dto';

export class PermissionResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'WRITE_INSCRIPTIONS' })
  nomPermission: string;

  @ApiPropertyOptional({ example: 'Permet de créer et modifier des inscriptions' })
  description?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedPermissionResponseDto {
  @ApiProperty({ type: [PermissionResponseDto] })
  data: PermissionResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
