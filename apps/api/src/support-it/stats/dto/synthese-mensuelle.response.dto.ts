import { ApiProperty } from '@nestjs/swagger';
import { NatureRequete, SousServiceIT, StatutRequete } from '@prisma/client';

class RepartitionParNatureDto {
  @ApiProperty({ enum: NatureRequete })
  nature: NatureRequete;

  @ApiProperty()
  total: number;
}

class RepartitionParStatutDto {
  @ApiProperty({ enum: StatutRequete })
  statut: StatutRequete;

  @ApiProperty()
  total: number;
}

class SyntheseSousServiceDto {
  @ApiProperty({ enum: SousServiceIT })
  sousService: SousServiceIT;

  @ApiProperty()
  totalRequetes: number;

  @ApiProperty({ type: [RepartitionParNatureDto] })
  parNature: RepartitionParNatureDto[];

  @ApiProperty({ type: [RepartitionParStatutDto] })
  parStatut: RepartitionParStatutDto[];
}

export class SyntheseMensuelleResponseDto {
  @ApiProperty({ example: '2026-08' })
  mois: string;

  @ApiProperty({ type: [SyntheseSousServiceDto] })
  parSousService: SyntheseSousServiceDto[];
}
