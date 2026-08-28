/**
 * Types miroir des DTO backend du module Support IT
 * (apps/api/src/support-it/**). Les dates JSON arrivent en `string` (ISO),
 * jamais en `Date` — conversion à faire uniquement à l'affichage.
 */

// Enums — miroir exact de apps/api/prisma/schema.prisma
export type NatureRequete =
  | "PANNE_MATERIEL"
  | "ACCES_COMPTE"
  | "INSTALLATION_LOGICIEL"
  | "INCIDENT_SECURITE"
  | "RESEAU"
  | "AUTRE";

export type SousServiceIT = "CENTRE_INFORMATIQUE" | "CYBER" | "MAINTENANCE";

export type StatutRequete = "OUVERTE" | "EN_COURS" | "CLOTUREE";

export type StatutInscriptionCoursSupportIT = "EN_COURS" | "TERMINE" | "ABANDONNE";

export type StatutPoste = "DISPONIBLE" | "HORS_SERVICE";

// Miroir de RequeteResponseDto (apps/api/src/support-it/requetes/dto/requete.response.dto.ts)
export interface RequeteResponseDto {
  id: string;
  demandeurId: string;
  demandeurNom: string;
  demandeurPrenom: string;
  nature: NatureRequete;
  sousServiceCible: SousServiceIT;
  description: string;
  statut: StatutRequete;
  dateOuverture: string;
  dateCloture: string | null;
  createdAt: string;
  updatedAt: string;
}

// Miroir de InterventionResponseDto (apps/api/src/support-it/interventions/dto/intervention.response.dto.ts)
export interface InterventionResponseDto {
  id: string;
  requeteId: string;
  technicienId: string;
  technicienNom: string;
  technicienPrenom: string;
  date: string;
  compteRendu: string;
  createdAt: string;
  updatedAt: string;
}

// Miroir de CoursSupportITResponseDto (apps/api/src/support-it/cours/dto/cours.response.dto.ts)
export interface CoursSupportITResponseDto {
  id: string;
  titre: string;
  contenu: string;
  niveau: string;
  duree: number;
  createdAt: string;
  updatedAt: string;
}

// Miroir de InscriptionCoursSupportITResponseDto (apps/api/src/support-it/inscriptions/dto/inscription.response.dto.ts)
export interface InscriptionCoursSupportITResponseDto {
  id: string;
  participantId: string;
  coursId: string;
  coursTitre: string;
  statut: StatutInscriptionCoursSupportIT;
  progression: number;
  createdAt: string;
  updatedAt: string;
}

// Miroir de AttestationSupportITData (apps/api/src/support-it/attestations/attestation.types.ts)
// Forme provisoire du backend — voir le commentaire de tête du fichier source.
export interface AttestationSupportITData {
  participantNom: string;
  participantPrenom: string;
  coursTitre: string;
  dateReussite: string;
  numeroReference: string;
  contenu: string;
}

// Miroir de EvaluationSupportITResponseDto (apps/api/src/support-it/inscriptions/dto/evaluation.response.dto.ts)
export interface EvaluationSupportITResponseDto {
  id: string;
  inscriptionId: string;
  note: number;
  date: string;
  statutReussite: boolean;
  /** Présent uniquement si statutReussite === true (cf. commentaire du DTO backend). */
  attestation?: AttestationSupportITData;
}

// Miroir de PosteResponseDto (apps/api/src/support-it/postes/dto/poste.response.dto.ts)
export interface PosteResponseDto {
  id: string;
  salle: string;
  statut: StatutPoste;
  dateDerniereMaintenance: string | null;
  createdAt: string;
  updatedAt: string;
}

// Miroir de DisponibilitePosteDto (même fichier) — réponse non paginée (array brut).
export interface DisponibilitePosteDto {
  salle: string;
  total: number;
  disponibles: number;
  horsService: number;
}

// Miroir des classes internes de synthese-mensuelle.response.dto.ts
export interface RepartitionParNatureDto {
  nature: NatureRequete;
  total: number;
}

export interface RepartitionParStatutDto {
  statut: StatutRequete;
  total: number;
}

export interface SyntheseSousServiceDto {
  sousService: SousServiceIT;
  totalRequetes: number;
  parNature: RepartitionParNatureDto[];
  parStatut: RepartitionParStatutDto[];
}

// Miroir de SyntheseMensuelleResponseDto — réponse non paginée (objet brut).
export interface SyntheseMensuelleResponseDto {
  mois: string;
  parSousService: SyntheseSousServiceDto[];
}
