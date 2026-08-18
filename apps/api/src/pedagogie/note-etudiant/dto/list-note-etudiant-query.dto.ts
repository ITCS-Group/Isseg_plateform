import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListNoteEtudiantQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrer par UUID d’Epreuve' })
  @IsOptional()
  @IsUUID('4')
  epreuveId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrer par UUID d’Inscription' })
  @IsOptional()
  @IsUUID('4')
  inscriptionId?: string;
}
