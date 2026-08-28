/**
 * Table de capacités frontend — miroir exact des `@Roles()` backend vérifiés
 * dans les controllers du module support-it et de la messagerie
 * (apps/api/src/support-it et apps/api/src/messagerie). Sert uniquement à
 * l'UX (masquer un bouton) — le backend reste la seule autorité de sécurité,
 * un contournement frontend serait de toute façon rejeté serveur.
 *
 * Ne couvre que les capacités déjà vérifiées ; ne pas étendre sans revérifier
 * le `@Roles()` réel correspondant dans le controller concerné.
 */
export const SUPPORT_IT_CAPABILITIES = {
  requetes: {
    // PATCH /requetes/:id/cloturer — @Roles('TECHNICIEN', 'RESPONSABLE_IT', 'ADMIN')
    cloturer: ["TECHNICIEN", "RESPONSABLE_IT", "ADMIN"],
  },
  interventions: {
    // POST /requetes/:requeteId/interventions — @Roles('TECHNICIEN')
    create: ["TECHNICIEN"],
  },
  cours: {
    // POST /cours-support-it — @Roles('RESPONSABLE_IT', 'ADMIN')
    create: ["RESPONSABLE_IT", "ADMIN"],
  },
  evaluations: {
    // POST /inscriptions-support-it/:id/evaluation — @Roles('RESPONSABLE_IT', 'ADMIN')
    create: ["RESPONSABLE_IT", "ADMIN"],
  },
  postes: {
    // POST /postes — @Roles('RESPONSABLE_IT', 'ADMIN')
    create: ["RESPONSABLE_IT", "ADMIN"],
    // PATCH /postes/:id/statut — @Roles('RESPONSABLE_IT', 'ADMIN', 'TECHNICIEN')
    updateStatut: ["RESPONSABLE_IT", "ADMIN", "TECHNICIEN"],
  },
  synthese: {
    // @Roles('RESPONSABLE_IT', 'ADMIN') au niveau du StatsController
    view: ["RESPONSABLE_IT", "ADMIN"],
  },
} as const;

type SupportItCapabilities = typeof SUPPORT_IT_CAPABILITIES;
type SupportItArea = keyof SupportItCapabilities;
type SupportItAction<Area extends SupportItArea> = keyof SupportItCapabilities[Area];

/** Vrai si au moins un des rôles de l'utilisateur possède la capacité demandée. */
export function hasCapability<Area extends SupportItArea>(
  roles: string[],
  area: Area,
  action: SupportItAction<Area>,
): boolean {
  const allowedRoles = SUPPORT_IT_CAPABILITIES[area][action] as readonly string[];
  return roles.some((role) => allowedRoles.includes(role));
}
