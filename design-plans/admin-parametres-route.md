# Plan — Créer la route `/admin/parametres` (lien cassé de la sidebar Admin)

## Contexte pour l'exécutant

Ce plan est autonome : il ne suppose aucune connaissance préalable de l'audit ou de la
conversation qui l'a produit. Toutes les informations nécessaires à l'implémentation
sont ci-dessous.

- **Dépôt** : `Isseg_plateform` (monorepo pnpm/Turborepo)
- **Branche à utiliser** : `feat/admin-parametres-route` (nouvelle branche dédiée, à créer
  depuis `main` à jour)
- **Application** : `apps/web` (Next.js 14, App Router, TailwindCSS) — chantier
  **purement frontend**, aucune modification backend nécessaire (voir "Preuve" ci-dessous)

## Origine du finding

Comparaison de la maquette Figma Make de référence (`Portail de gestion académique`,
écran `AdminDashboard.tsx`, onglet "Paramètres") avec l'état actuel du code : la sidebar
Admin (`apps/web/src/app/admin/_components/AdminSidebar.tsx`) pointe déjà l'item
"Paramètres" vers `href: "/admin/parametres"`, mais **cette route n'existe pas** dans
`apps/web/src/app` — aucun fichier `admin/parametres/page.tsx`. Cliquer sur "Paramètres"
dans la sidebar produit donc un 404.

## Objectif

Créer la route `/admin/parametres` et y monter le composant
`IdentityManagement.tsx` — déjà entièrement écrit, fonctionnel, mais actuellement
**orphelin** (importé nulle part). Corriger un lien cassé, pas construire un nouvel
écran.

## Preuve / état actuel exact

**1. Le composant cible existe déjà et documente lui-même son propre plan** —
`apps/web/src/app/admin/_components/IdentityManagement.tsx`, lignes 1-10 :
```tsx
/**
 * Gestion Utilisateurs/Rôles/Permissions — code de l'ancien contenu de
 * /admin (chantier Étape 2), préservé tel quel dans l'attente de l'Étape 5
 * ("Déplacement du RBAC") qui le montera sous /admin/parametres/*. Pas encore
 * importé/routé nulle part à ce stade (Étape 3 = Dashboard visuel uniquement)
 * — composant intentionnellement inutilisé pour l'instant, pas du code mort
 * à supprimer.
 */
```
Ce plan **est** cette "Étape 5" annoncée par le commentaire — il ne s'agit pas d'un
nouveau chantier inventé mais de la suite documentée d'un chantier précédent
(`a28fe60 feat(web): scaffold du Dashboard Admin (shell, sans données réelles)`).

**2. Le layout partagé confirme aussi cette intention** —
`apps/web/src/app/admin/layout.tsx`, ligne 9 :
```tsx
/**
 * Shell partagé par /admin et toutes ses sous-routes (/admin/parametres/*).
 * Garde RBAC exécutée une seule fois ici — les pages filles ne doivent plus
 * appeler useProtectedRoute elles-mêmes.
 */
```
`IdentityManagement.tsx` n'appelle pas `useProtectedRoute` (seulement `useAuthStore()`,
en lecture) — déjà conforme à cette contrainte, rien à changer sur ce point.

**3. La sidebar est déjà câblée et n'a besoin d'aucune modification** —
`AdminSidebar.tsx` :
```tsx
{ key: "settings", label: "Paramètres", icon: Settings, href: "/admin/parametres", matchPrefix: true },
```
`matchPrefix: true` signifie que l'item restera actif sur toute sous-route
(`/admin/parametres/utilisateurs`, etc. si elles existent un jour) — déjà correct pour
ce plan.

**4. Aucune divergence entre `IdentityManagement.tsx` et les DTOs actuels du backend** —
vérifié en comparant les interfaces attendues par le composant et les DTOs réels :
- `GET /utilisateurs` → `PaginatedUsersResponseDto` (`apps/api/src/identity/users/dto/user.response.dto.ts`) : `{ data: UserResponseDto[], meta: PaginationMetaDto }`, `UserResponseDto` = `{ id, nom, prenom, email, estActif, roles: {id, nomRole}[] }` — correspond exactement à `PaginatedUtilisateurs`/`UtilisateurItem` attendus par le composant.
- `GET /roles` → `RoleResponseDto[]` (`apps/api/src/identity/roles/dto/role.response.dto.ts`) : `{ id, nomRole, permissions: {id, nomPermission, description?}[] }` — correspond à `RoleItem`.
- `GET /permissions` → `PermissionResponseDto[]` (`apps/api/src/identity/permissions/dto/permission.response.dto.ts`) : `{ id, nomPermission, description? }` — correspond à `PermissionItem`.

Les trois endpoints exigent `@Roles('ADMIN')` au niveau contrôleur (`GET /utilisateurs`
autorise en plus `SCOLARITE`) — le compte utilisé sur `/admin` est toujours `ADMIN`,
donc aucun problème d'accès. **Aucune migration, aucun changement de contrat API,
aucune nouvelle dépendance : uniquement du branchement de route côté frontend.**

## Correction à apporter

### Étape unique — Créer `apps/web/src/app/admin/parametres/page.tsx`

```tsx
import { IdentityManagement } from "../_components/IdentityManagement";

export default function AdminParametresPage() {
  return <IdentityManagement />;
}
```

Pas de `"use client"` nécessaire sur ce fichier : il ne contient aucun hook, il se
contente de rendre un composant client existant (`IdentityManagement.tsx` porte déjà
`"use client"` en première ligne) — pattern standard App Router.

Retirer, dans `IdentityManagement.tsx`, le commentaire de tête (lignes 3-10) qui décrit
le composant comme "intentionnellement inutilisé" — devenu obsolète une fois la route
créée. Le reste du fichier reste inchangé (aucune logique, aucun style, aucun DTO à
toucher).

## Hors périmètre — ne pas toucher

- **Les deux autres sous-onglets visibles dans le Figma pour "Paramètres" ("Année
  académique", "Intégrations")** : le Figma Make montre 3 sous-onglets
  (`année`/`utilisateurs`/`intégrations`) sous "Paramètres", mais `IdentityManagement.tsx`
  n'en couvre qu'un seul en pratique, avec une structure différente (3 onglets
  `utilisateurs`/`rôles`/`permissions`, pas de gestion d'année académique ni
  d'intégrations Moodle/SMTP/SMS). **Ce plan ne construit pas ces écrans manquants** —
  il se limite à corriger le lien cassé avec le composant RBAC déjà existant. Si la
  gestion de l'année académique et des intégrations est un besoin réel, cela doit être
  un chantier distinct (nécessitant d'abord de vérifier l'existant côté `apps/api`).
- `AdminSidebar.tsx`, `AdminHeader.tsx`, `apps/web/src/app/admin/layout.tsx` : déjà
  corrects, aucune modification.
- `apps/web/src/app/admin/page.tsx` (le tableau de bord) : inchangé.
- Le backend (`apps/api`) : aucune modification, les 3 endpoints existent déjà et
  correspondent exactement à ce qu'attend le composant.
- Les écrans "Cours & filières" et "Rapports & indicateurs" identifiés dans le même
  audit Figma : hors périmètre, chacun mérite son propre plan (cf. discussion
  précédente).
- Le contenu/la logique interne de `IdentityManagement.tsx` : aucune modification en
  dehors de la suppression du commentaire devenu obsolète.

## Vérifications attendues après implémentation

1. **`tsc --noEmit`** (depuis `apps/web`) → code de sortie `0`.
2. **`git status` / `git diff`** → doit montrer exactement :
   - 1 fichier créé : `apps/web/src/app/admin/parametres/page.tsx`
   - 1 fichier modifié : `apps/web/src/app/admin/_components/IdentityManagement.tsx`
     (suppression du commentaire de tête uniquement)
   - Aucun autre fichier touché
3. **Test navigateur** (compte `ADMIN`) :
   - Se connecter, ouvrir `/admin`, cliquer sur "Paramètres" dans la sidebar
   - Vérifier la navigation vers `/admin/parametres` (plus de 404), l'item "Paramètres"
     de la sidebar apparaît actif (surlignage)
   - Vérifier l'affichage des 3 onglets "Utilisateurs" / "Rôles" / "Permissions", avec
     données réelles (pagination fonctionnelle sur "Utilisateurs")
   - Vérifier l'absence d'erreur console

## Critère de réussite

Le plan est terminé avec succès si : `/admin/parametres` affiche la gestion
Utilisateurs/Rôles/Permissions sans erreur, la sidebar reflète l'état actif correct,
`tsc --noEmit` est à `0`, et le `git diff` correspond exactement à la liste de fichiers
de la section "Vérifications" ci-dessus.
