/**
 * Forme PROVISOIRE de l'attestation Support IT — un unique gabarit texte
 * codé en dur, aucune signature, aucune numérotation officielle. Scopée à
 * Support IT uniquement (pas un service de certification générique). À
 * généraliser (multi-templates, signature, numérotation officielle) quand
 * le Centre d'Innovation Pédagogique démarrera et qu'un second cas d'usage
 * réel existe — ne pas anticiper cette forme finale avant. Voir
 * STATUT_MODULES.md et AttestationService.
 */
export interface AttestationSupportITData {
  participantNom: string;
  participantPrenom: string;
  coursTitre: string;
  dateReussite: Date;
  numeroReference: string;
  contenu: string;
}
