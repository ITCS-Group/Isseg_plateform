import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TypeDocumentAcademique } from '@prisma/client';
import { PaginationMetaDto } from '../../../common/dto/pagination.dto';

export class DocumentAcademiqueResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: TypeDocumentAcademique })
  type: TypeDocumentAcademique;

  @ApiProperty()
  titre: string;

  @ApiProperty()
  anneeUniversitaire: string;

  @ApiProperty()
  filiere: string;

  @ApiProperty()
  niveau: string;

  @ApiProperty()
  urlPdf: string;

  @ApiProperty({ type: [String] })
  motsCles: string[];

  @ApiProperty()
  resume: string;

  @ApiProperty()
  diffusionAutorisee: boolean;

  @ApiPropertyOptional({ nullable: true })
  embargoJusqua: Date | null;

  @ApiProperty()
  nombreTelechargements: number;

  @ApiProperty()
  nombreVues: number;

  @ApiProperty({ format: 'uuid' })
  auteurId: string;

  @ApiProperty()
  auteurNom: string;

  @ApiProperty()
  auteurPrenom: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  directeurMemoireId: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedDocumentAcademiqueResponseDto {
  @ApiProperty({ type: [DocumentAcademiqueResponseDto] })
  data: DocumentAcademiqueResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
