import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination.dto';

export class InterventionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  requeteId: string;

  @ApiProperty({ format: 'uuid' })
  technicienId: string;

  @ApiProperty()
  technicienNom: string;

  @ApiProperty()
  technicienPrenom: string;

  @ApiProperty()
  date: Date;

  @ApiProperty()
  compteRendu: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedInterventionResponseDto {
  @ApiProperty({ type: [InterventionResponseDto] })
  data: InterventionResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
