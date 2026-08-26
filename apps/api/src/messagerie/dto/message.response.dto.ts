import { ApiProperty } from '@nestjs/swagger';

class DestinataireDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  nom: string;

  @ApiProperty()
  prenom: string;
}

export class MessageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  expediteurId: string;

  @ApiProperty()
  expediteurNom: string;

  @ApiProperty()
  expediteurPrenom: string;

  @ApiProperty({ type: [DestinataireDto] })
  destinataires: DestinataireDto[];

  @ApiProperty()
  contenu: string;

  @ApiProperty()
  date: Date;

  @ApiProperty()
  createdAt: Date;
}
