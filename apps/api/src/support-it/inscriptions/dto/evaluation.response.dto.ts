import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AttestationSupportITData } from '../../attestations/attestation.types';

export class EvaluationSupportITResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  inscriptionId: string;

  @ApiProperty()
  note: number;

  @ApiProperty()
  date: Date;

  @ApiProperty()
  statutReussite: boolean;

  @ApiPropertyOptional({
    description: 'Présent uniquement si statutReussite = true (stub provisoire, voir AttestationService)',
  })
  attestation?: AttestationSupportITData;
}
