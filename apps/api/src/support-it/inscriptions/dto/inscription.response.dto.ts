import { ApiProperty } from '@nestjs/swagger';
import { StatutInscriptionCoursSupportIT } from '@prisma/client';
import { PaginationMetaDto } from '../../../common/dto/pagination.dto';

export class InscriptionCoursSupportITResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  participantId: string;

  @ApiProperty({ format: 'uuid' })
  coursId: string;

  @ApiProperty()
  coursTitre: string;

  @ApiProperty({ enum: StatutInscriptionCoursSupportIT })
  statut: StatutInscriptionCoursSupportIT;

  @ApiProperty()
  progression: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedInscriptionCoursSupportITResponseDto {
  @ApiProperty({ type: [InscriptionCoursSupportITResponseDto] })
  data: InscriptionCoursSupportITResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
