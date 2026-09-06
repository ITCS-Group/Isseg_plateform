import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination.dto';

export class CoursClasseResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', description: 'UUID du CoursScenarise associé' })
  coursId: string;

  @ApiProperty({ format: 'uuid', description: 'UUID de la Classe associée' })
  classeId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ description: 'Code du cours (CoursScenarise.codeCours)', example: 'SEDU-L3-S1-101' })
  coursCode: string;

  @ApiProperty({ description: 'Intitulé du cours (CoursScenarise.titre)' })
  coursTitre: string;

  @ApiProperty({ description: 'Code de la classe (Classe.codeClasse)' })
  classeCode: string;

  @ApiProperty({ description: 'Libellé de la classe (Classe.libelle)' })
  classeLibelle: string;

  @ApiProperty({ description: 'Niveau de la classe (Classe.niveau)', example: 'L3' })
  classeNiveau: string;
}

export class PaginatedCoursClasseResponseDto {
  @ApiProperty({ type: [CoursClasseResponseDto] })
  data: CoursClasseResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
