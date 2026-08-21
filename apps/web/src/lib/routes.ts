/**
 * Mapping rôle → route du tableau de bord correspondant. Source unique de
 * vérité pour la redirection après connexion et la garde d'accès aux pages
 * protégées — évite de dupliquer la liste des rôles autorisés à chaque page
 * (cf. login/page.tsx et teacher/page.tsx, qui répétaient toutes deux
 * `["ENSEIGNANT", "ADMIN"]` avant ce fichier).
 */
export const ROLE_DASHBOARD_ROUTES: Record<string, string> = {
  ADMIN: "/teacher",
  ENSEIGNANT: "/teacher",
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
