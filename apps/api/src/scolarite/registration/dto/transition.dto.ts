import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * DTO de base commun à toutes les transitions du workflow.
 *
 * `expectedVersion` porte l'optimistic locking : il correspond à la version
 * du dossier telle que lue par l'appelant avant la transition.
 */
export class TransitionDto {
  @ApiProperty({
    minimum: 1,
    description: 'Version attendue du dossier (optimistic locking)',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @ApiPropertyOptional({
    maxLength: 1000,
    description: 'Commentaire libre optionnel associé à la transition',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
