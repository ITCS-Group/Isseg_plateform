import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TransitionDto } from './transition.dto';

/**
 * DTO de la transition T4 : EN_TRAITEMENT → REJETE.
 *
 * Le motif de rejet est OBLIGATOIRE et non vide (après trim).
 */
export class RejectDossierDto extends TransitionDto {
  @ApiProperty({
    maxLength: 1000,
    description: 'Motif du rejet (obligatoire, non vide)',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  motifRejet: string;
}
