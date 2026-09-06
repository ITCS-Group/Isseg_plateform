import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatutEmprunt } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListEmpruntQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Filtrer par emprunteur — ignoré et remplacé par l’id de l’appelant pour un rôle scoping (ETUDIANT/ENSEIGNANT)',
  })
  @IsOptional()
  @IsUUID('4')
  emprunteurId?: string;

  @ApiPropertyOptional({ enum: StatutEmprunt })
  @IsOptional()
  @IsEnum(StatutEmprunt)
  statut?: StatutEmprunt;
}
