/**
 * Types miroir des DTO backend de la messagerie interne
 * (apps/api/src/messagerie/dto/message.response.dto.ts).
 */

export interface DestinataireDto {
  id: string;
  nom: string;
  prenom: string;
}

export interface MessageResponseDto {
  id: string;
  expediteurId: string;
  expediteurNom: string;
  expediteurPrenom: string;
  destinataires: DestinataireDto[];
  contenu: string;
  date: string;
  createdAt: string;
}
