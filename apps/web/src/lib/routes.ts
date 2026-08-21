/**
 * Mapping rôle → route du tableau de bord correspondant. Source unique de
 * vérité pour la redirection après connexion et la garde d'accès aux pages
 * protégées. Couvre les 17 rôles réellement seedés (apps/api/prisma/seed.ts) —
 * chantier d'harmonisation des routes (validé explicitement, 2026-08-21).
 *
 * Plusieurs rôles peuvent pointer vers le même dashboard frontend (ex.
 * ADMIN/SUPER_ADMIN → /admin) : cela ne fusionne PAS leurs permissions
 * backend, qui restent la seule source de vérité pour les autorisations
 * (cf. @Roles() sur chaque controller NestJS). Ce mapping ne détermine que
 * l'expérience de redirection post-connexion, jamais une permission.
 *
 * Seules /login et /enseignant ont une page réelle à ce jour. Les autres
 * routes ci-dessous sont enregistrées pour la résolution de dashboard mais
 * n'ont volontairement aucune page derrière (pas de dashboard métier créé
 * dans ce chantier — cf. rapport de la phase RBAC/routes) : une redirection
 * vers l'une d'elles aboutit au 404 natif de Next.js tant que la page
 * correspondante n'existe pas. C'est un comportement assumé, pas un bug —
 * ne pas masquer ces routes manquantes par un repli arbitraire vers
 * /enseignant.
 */
export const ROLE_DASHBOARD_ROUTES: Record<string, string> = {
  SUPER_ADMIN: "/admin",
  ADMIN: "/admin",
  ENSEIGNANT: "/enseignant",
  DGA_ETUDES: "/pedagogie",
  CHEF_DEPARTEMENT: "/pedagogie",
  SCOLARITE: "/scolarite",
  BIBLIOTHECAIRE: "/bibliotheque",
  RESPONSABLE_BIBLIOTHEQUE: "/bibliotheque",
  RESPONSABLE_NUMERISATION: "/numerisation",
  ETUDIANT: "/etudiant",
  COMPTABLE: "/comptabilite",
  RH: "/rh",
  DIRECTEUR_GENERAL: "/direction",
  DIRECTEUR_INNOVATION: "/innovation",
  RESPONSABLE_PUBLICATIONS: "/publications",
  RESPONSABLE_IT: "/it",
  PARENT: "/parent",
};

/** Route du tableau de bord pour le premier rôle reconnu de l'utilisateur, ou `null` si aucun. */
export function resolveDashboardRoute(roles: string[]): string | null {
  for (const role of roles) {
    const route = ROLE_DASHBOARD_ROUTES[role];
    if (route) return route;
  }
  return null;
}

/** Vrai si au moins un des rôles de l'utilisateur donne accès à cette route. */
export function isRoleAllowedForRoute(roles: string[], route: string): boolean {
  return roles.some((role) => ROLE_DASHBOARD_ROUTES[role] === route);
}
