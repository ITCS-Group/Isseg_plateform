import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatutPoste } from '@prisma/client';
import { PaginationMetaDto } from '../../../common/dto/pagination.dto';

export class PosteResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  salle: string;

  @ApiProperty({ enum: StatutPoste })
  statut: StatutPoste;

  @ApiPropertyOptional({ nullable: true })
  dateDerniereMaintenance: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedPosteResponseDto {
  @ApiProperty({ type: [PosteResponseDto] })
  data: PosteResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class DisponibilitePosteDto {
  @ApiProperty()
  salle: string;

  @ApiProperty()
  total: number;

  @ApiProperty()
  disponibles: number;

  @ApiProperty()
  horsService: number;
}
