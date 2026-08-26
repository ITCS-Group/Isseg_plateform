import { NatureRequete, SousServiceIT } from '@prisma/client';

/**
 * Routage automatique nature → sous-service (schema.prisma § SUPPORT
 * INFORMATIQUE). Première proposition de routage, ajustable sans migration
 * (logique applicative, pas figée en base) — cf. RequeteService.
 */
export const NATURE_SOUS_SERVICE_MAP: Record<NatureRequete, SousServiceIT> = {
  [NatureRequete.PANNE_MATERIEL]: SousServiceIT.MAINTENANCE,
  [NatureRequete.RESEAU]: SousServiceIT.MAINTENANCE,
  [NatureRequete.INCIDENT_SECURITE]: SousServiceIT.CYBER,
  [NatureRequete.ACCES_COMPTE]: SousServiceIT.CENTRE_INFORMATIQUE,
  [NatureRequete.INSTALLATION_LOGICIEL]: SousServiceIT.CENTRE_INFORMATIQUE,
  [NatureRequete.AUTRE]: SousServiceIT.CENTRE_INFORMATIQUE,
};
