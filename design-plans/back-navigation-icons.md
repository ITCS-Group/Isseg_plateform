# Plan — Icône de retour entre les sous-pages `/it`

## Contexte pour l'exécutant

Ce plan est autonome : il ne suppose aucune connaissance préalable de l'audit ou de la
conversation qui l'a produit. Toutes les informations nécessaires à l'implémentation
sont ci-dessous.

- **Dépôt** : `Isseg_plateform` (monorepo pnpm/Turborepo)
- **Branche à utiliser** : `feat/it-back-navigation` (nouvelle branche dédiée, à créer
  depuis `main` à jour — ce chantier est indépendant de `feat/support-it-frontend`)
- **Application** : `apps/web` (Next.js 14, App Router, TailwindCSS) + `packages/ui`
  (`@isseg/ui`, transpilé directement par Next.js via `transpilePackages`, aucune étape
  de build séparée)
- **Convention du dépôt** (`.claude/CLAUDE.md`, section "Système de design & guidelines
  UI") : les composants partagés vivent dans `packages/ui`, importés via `@isseg/ui` —
  jamais dupliqués entre écrans.

## Objectif

Ajouter une icône de retour (flèche) sur les pages de détail imbriquées sous `/it`, pour
fluidifier la navigation entre une page de détail et sa liste parente. Remplacer au
passage le lien texte "←" déjà présent sur une des deux pages par une vraie icône
(cohérence avec le reste de l'application, qui utilise systématiquement `lucide-react`
pour ses icônes — `StatCard`, `AppSidebar`, `ItSidebar`, `AdminSidebar`, etc., jamais de
caractère Unicode brut).

## Preuve / état actuel exact

**Recherche exhaustive des routes imbriquées** (`find apps/web/src/app -type d -name
"[*]"`) : il n'existe que **deux** routes dynamiques dans toute l'application, toutes
deux sous `/it` :

```
apps/web/src/app/it/requetes/[id]
apps/web/src/app/it/cours/[id]
```

Aucune autre page de détail imbriquée n'existe ailleurs (`/admin`, `/enseignant` sont des
pages plates, sans sous-route).

**État des deux pages concernées :**

1. `apps/web/src/app/it/cours/[id]/page.tsx` — **a déjà** un lien de retour, mais en
   texte brut, pas en icône (lignes 4, 45-47) :
   ```tsx
   import Link from "next/link";
   // ...
   <Link href="/it/cours" className="text-sm text-navy/60 hover:text-navy">
     ← Retour aux cours
   </Link>
   ```
   `Link` n'est utilisé nulle part ailleurs dans ce fichier (vérifié par recherche) — il
   peut être entièrement retiré si remplacé par le composant partagé.

2. `apps/web/src/app/it/requetes/[id]/page.tsx` — **n'a aucun** lien de retour. La page
   commence directement par le titre (lignes 141-143) :
   ```tsx
   return (
     <div className="p-6">
       <h1 className="text-xl font-semibold text-navy">Détail de la requête</h1>
   ```

**`lucide-react`** est déjà une dépendance à la fois de `apps/web` (`package.json`) et de
`packages/ui` (`package.json`), déjà utilisée abondamment (`StatCard`, les sidebars, les
headers) — aucune nouvelle dépendance à ajouter. Aucune icône `ArrowLeft` n'est
actuellement importée nulle part dans le dépôt (vérifié par recherche) : ce sera son
premier usage, cohérent avec la bibliothèque déjà en place.

**Composants partagés existants dans `packages/ui/src/`** (pour convention de style) :
`IssegLogo.tsx`, `AppSidebar.tsx`, `AppHeader.tsx` — aucun n'a `"use client"` sauf
`AppHeader` (qui a des `onClick`). Un lien de retour n'a besoin ni d'état ni
d'écouteur d'événement (`next/link` fonctionne en Server Component) — pas de
`"use client"` nécessaire pour le nouveau composant.

**`packages/ui/src/index.ts`** actuel :
```ts
export { IssegLogo } from "./IssegLogo";
export { AppSidebar } from "./AppSidebar";
export type { AppSidebarItem, AppSidebarProps } from "./AppSidebar";
export { AppHeader } from "./AppHeader";
export type { AppHeaderProps } from "./AppHeader";
```

## Correction à apporter

Comme pour `StatCard` (composant dupliqué déjà extrait vers `@isseg/ui` dans un chantier
précédent), un lien de retour utilisé sur au moins deux écrans doit être un composant
partagé dès sa création, pas dupliqué inline dans chaque page — cohérent avec la
convention citée plus haut.

### Étape 1 — Création du composant partagé

Créer `packages/ui/src/BackLink.tsx` :

```tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export interface BackLinkProps {
  href: string;
  label: string;
}

export function BackLink({ href, label }: BackLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm text-navy/60 hover:text-navy"
    >
      <ArrowLeft size={16} strokeWidth={1.75} />
      {label}
    </Link>
  );
}
```

Le style (`text-sm text-navy/60 hover:text-navy`) reprend exactement celui du lien texte
déjà en place sur `/it/cours/[id]` — pas une valeur inventée, juste la même habillée
d'une icône `ArrowLeft` (`size={16}`, cohérent avec la taille d'icône déjà utilisée par
`StatCard` — `size={18}` — à l'échelle d'un lien texte plus petit).

### Étape 2 — Export

Ajouter à `packages/ui/src/index.ts` :

```ts
export { BackLink } from "./BackLink";
export type { BackLinkProps } from "./BackLink";
```

### Étape 3 — `apps/web/src/app/it/cours/[id]/page.tsx`

Remplacer :
```tsx
import Link from "next/link";
```
(ligne 4, à retirer — plus utilisé ailleurs dans ce fichier) par un import de
`BackLink` aux côtés des autres imports `@/lib/...`.

Remplacer (lignes 45-47) :
```tsx
<Link href="/it/cours" className="text-sm text-navy/60 hover:text-navy">
  ← Retour aux cours
</Link>
```
par :
```tsx
<BackLink href="/it/cours" label="Retour aux cours" />
```

### Étape 4 — `apps/web/src/app/it/requetes/[id]/page.tsx`

Ajouter l'import `BackLink` (aux côtés des imports `@/lib/...`, ligne ~7).

Insérer avant le `<h1>` existant (ligne 143) :
```tsx
<BackLink href="/it/requetes" label="Retour aux requêtes" />
```
suivi d'un espacement cohérent avec le pattern déjà utilisé sur `/it/cours/[id]` (le
`<h1>` y porte `mt-2` pour compenser l'espace après le lien — à reproduire ici de la
même façon plutôt qu'inventer un espacement différent).

## Hors périmètre — ne pas toucher

- **Les pages de liste de premier niveau accessibles depuis la sidebar** (`/it`,
  `/it/requetes`, `/it/cours`, `/it/postes`, `/it/inscriptions`, `/it/messagerie`,
  `/it/synthese`) : elles sont déjà à un clic du tableau de bord via `ItSidebar`
  (toujours visible), ce ne sont pas des "sous-pages" au sens routes imbriquées — aucune
  route dynamique de premier niveau n'a de parent. Ajouter une flèche de retour ici
  serait une extension du périmètre non justifiée par l'état actuel du code. **Si le
  besoin est en réalité plus large (ex. retour systématique vers le tableau de bord
  depuis n'importe quelle page de liste), le confirmer avant d'étendre ce plan** — ce
  document ne couvre que les deux routes `[id]` existantes.
- `/admin`, `/enseignant`, `/login` : aucune route imbriquée, hors périmètre.
- `AppSidebar`, `AppHeader`, `ItSidebar`, `AdminSidebar` : aucune modification.
- Le contenu métier des deux pages de détail (logique de clôture, formulaire
  d'intervention, affichage des champs) : inchangé.
- Les permissions (`hasCapability`) : inchangées.
- Le design system (`tailwind.config.ts`), les tokens : inchangés.
- Le backend, les routes API : hors périmètre (aucune modification nécessaire, pure
  navigation front).
- Aucune nouvelle dépendance npm (`lucide-react` déjà présent des deux côtés).
- Aucun nettoyage opportuniste d'autres fichiers.

## Vérifications attendues après implémentation

1. **`tsc --noEmit`** (depuis `apps/web`, et si le monorepo le permet, `packages/ui`
   aussi) → code de sortie `0`.
2. **`git status` / `git diff`** → doit montrer exactement :
   - 1 fichier créé : `packages/ui/src/BackLink.tsx`
   - 1 fichier modifié : `packages/ui/src/index.ts` (deux lignes ajoutées)
   - 2 fichiers modifiés : `apps/web/src/app/it/cours/[id]/page.tsx`,
     `apps/web/src/app/it/requetes/[id]/page.tsx`
   - Aucun autre fichier touché
3. **Test navigateur — `/it/cours/[id]`** : ouvrir le détail d'un cours, vérifier que la
   flèche de retour (icône, plus de caractère "←" brut) s'affiche avant le titre, cliquer
   dessus → retour à `/it/cours`, liste intacte.
4. **Test navigateur — `/it/requetes/[id]`** : ouvrir le détail d'une requête, vérifier
   que la flèche de retour s'affiche avant le titre "Détail de la requête", cliquer
   dessus → retour à `/it/requetes`, liste intacte. Vérifier que le bouton "Clôturer" et
   le dialogue de confirmation (déjà corrigés dans un chantier précédent) restent
   fonctionnels et visuellement inchangés.
5. Aucune erreur console sur les deux pages.

## Critère de réussite

Le plan est terminé avec succès si : les deux pages de détail (`/it/cours/[id]`,
`/it/requetes/[id]`) affichent une icône de retour cohérente vers leur liste parente, le
composant est partagé via `@isseg/ui` (pas dupliqué), `tsc --noEmit` est à `0`, et le
`git diff` correspond exactement à la liste de fichiers de la section "Vérifications"
ci-dessus.
