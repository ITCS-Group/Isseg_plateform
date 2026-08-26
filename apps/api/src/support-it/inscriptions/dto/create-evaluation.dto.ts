import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, Max, Min } from 'class-validator';

export class CreateEvaluationSupportITDto {
  @ApiProperty({ minimum: 0, maximum: 20 })
  @IsNumber()
  @Min(0)
  @Max(20)
  note: number;

  @ApiProperty({ description: 'Saisi manuellement par RESPONSABLE_IT — aucun auto-calcul' })
  @IsBoolean()
  statutReussite: boolean;
}
