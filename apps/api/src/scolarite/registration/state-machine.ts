import { StatutDossier } from '@prisma/client';

/**
 * Machine à états officielle du workflow DossierInscription.statutDossier (B1.1).
 *
 * Source UNIQUE de vérité des transitions autorisées.
 *
 *   BROUILLON → SOUMIS → EN_TRAITEMENT ─┬→ INSCRIT   (terminal)
 *                                       └→ REJETE    (terminal)
 *
 * Toute transition absente de cette table est interdite (sauts d'état,
 * retours arrière, X → X, sortie d'un état terminal).
 */
export const ALLOWED: Record<StatutDossier, StatutDossier[]> = {
  [StatutDossier.BROUILLON]: [StatutDossier.SOUMIS],
  [StatutDossier.SOUMIS]: [StatutDossier.EN_TRAITEMENT],
  [StatutDossier.EN_TRAITEMENT]: [StatutDossier.INSCRIT, StatutDossier.REJETE],
  [StatutDossier.INSCRIT]: [],
  [StatutDossier.REJETE]: [],
};

/** États terminaux : aucune transition sortante. */
export const TERMINAL_STATES: readonly StatutDossier[] = [
  StatutDossier.INSCRIT,
  StatutDossier.REJETE,
];

/**
 * Indique si la transition `from → to` fait partie des transitions autorisées.
 */
export function isTransitionAllowed(from: StatutDossier, to: StatutDossier): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

/**
 * Type d'événement Outbox associé à l'état CIBLE d'une transition.
 * Les 4 seules cibles possibles d'une transition valide sont couvertes.
 */
export const TRANSITION_EVENT_TYPE: Partial<Record<StatutDossier, string>> = {
  [StatutDossier.SOUMIS]: 'DossierInscriptionSubmitted',
  [StatutDossier.EN_TRAITEMENT]: 'DossierInscriptionProcessing',
  [StatutDossier.INSCRIT]: 'DossierInscriptionRegistered',
  [StatutDossier.REJETE]: 'DossierInscriptionRejected',
};
