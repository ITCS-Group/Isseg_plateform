import { StatutDossier } from '@prisma/client';

/**
 * Payload métier auto-suffisant d'un OutboxEvent de transition.
 *
 * Contient assez d'informations pour que le worker traite l'événement
 * sans reconstruire l'historique.
 */
export interface RegistrationOutboxPayload {
  dossierId: string;
  etudiantId: string;
  anneeId: string;
  classeId: string;
  fromStatus: StatutDossier;
  toStatus: StatutDossier;
  /** Version du dossier APRÈS incrément. */
  version: number;
  changedBy: string;
  /** Horodatage ISO 8601 de la transition. */
  changedAt: string;
  eventType: string;
  /** Présent uniquement pour EN_TRAITEMENT → INSCRIT. */
  matricule?: string;
  /** Présent uniquement pour EN_TRAITEMENT → REJETE. */
  motifRejet?: string;
}

/**
 * Résultat d'une transition réussie retourné par le use-case.
 */
export interface TransitionResult {
  dossierId: string;
  fromStatus: StatutDossier;
  toStatus: StatutDossier;
  /** Version du dossier APRÈS incrément. */
  version: number;
  /** Matricule (nouveau ou conservé) — uniquement lors du passage à INSCRIT. */
  matricule?: string;
}

/**
 * Options internes passées au cœur de transition.
 */
export interface TransitionOptions {
  comment?: string;
  motifRejet?: string;
}
