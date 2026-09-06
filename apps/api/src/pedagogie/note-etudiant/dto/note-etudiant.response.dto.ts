import { ApiProperty } from '@nestjs/swagger';
import { TypeEpreuve } from '@prisma/client';
import { PaginationMetaDto } from '../../../common/dto/pagination.dto';

export class NoteEtudiantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', description: 'UUID de l’Epreuve concernée' })
  epreuveId: string;

  @ApiProperty({ format: 'uuid', description: 'UUID de l’Inscription concernée' })
  inscriptionId: string;

  @ApiProperty({ description: 'Note brute' })
  noteBrute: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ enum: TypeEpreuve, description: 'Type de l’épreuve (via Epreuve.type)' })
  epreuveType: TypeEpreuve;

  @ApiProperty({ description: 'Code du cours (via Epreuve → CoursClasse → CoursScenarise)' })
  coursCode: string;

  @ApiProperty({ description: 'Intitulé du cours' })
  coursTitre: string;

  @ApiProperty({ description: 'Libellé de la classe (via Epreuve → CoursClasse → Classe)' })
  classeLibelle: string;

  @ApiProperty({ description: 'Nom de l’étudiant (via Inscription → Etudiant → Utilisateur)' })
  etudiantNom: string;

  @ApiProperty({ description: 'Prénom de l’étudiant' })
  etudiantPrenom: string;

  @ApiProperty({ nullable: true, description: 'Matricule de l’étudiant (peut être non attribué)' })
  etudiantMatricule: string | null;
}

export class PaginatedNoteEtudiantResponseDto {
  @ApiProperty({ type: [NoteEtudiantResponseDto] })
  data: NoteEtudiantResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
