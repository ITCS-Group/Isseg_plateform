import { ApiProperty } from '@nestjs/swagger';
import { TypeEpreuve } from '@prisma/client';
import { PaginationMetaDto } from '../../../common/dto/pagination.dto';

export class EpreuveResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', description: 'UUID du CoursClasse concerné' })
  coursClasseId: string;

  @ApiProperty({ enum: TypeEpreuve })
  type: TypeEpreuve;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedEpreuveResponseDto {
  @ApiProperty({ type: [EpreuveResponseDto] })
  data: EpreuveResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
