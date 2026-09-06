# Plan 2I-2 — Extraction de `StatCard` vers le composant partagé `@isseg/ui`

## Contexte pour l'exécutant

Ce plan est autonome : il ne suppose aucune connaissance préalable de l'audit ou de la
conversation qui l'a produit. Toutes les informations nécessaires à l'implémentation
sont ci-dessous.

- **Dépôt** : `Isseg_plateform` (monorepo pnpm/Turborepo)
- **Branche à utiliser** : `feat/support-it-frontend`
- **Commit de référence au moment de l'audit** : `aa4b86f` (`feat(support-it): portail
  /it complet (dashboard, listes, détails, actions métier)`)
- **Convention du dépôt** (`.claude/CLAUDE.md`, section "Système de design & guidelines
  UI") : *"Composants partagés (header, sidebar, logo…) vivent dans `packages/ui`
  (package `@isseg/ui`), importés par `apps/web` via `transpilePackages` dans
  `next.config.mjs` — jamais dupliqués entre écrans."*
- **Mécanique d'import** (déjà en place, à ne pas modifier) : `apps/web/next.config.mjs`
  contient `transpilePackages: ["@isseg/ui"]` ; `packages/ui/package.json` a
  `"main": "src/index.ts"` — **aucune étape de build/compilation n'existe pour ce
  package**, son code TypeScript est transpilé directement par Next.js. Ajouter un
  fichier et l'exporter depuis `index.ts` suffit, sans étape supplémentaire.

## Objectif

Éliminer la duplication du composant `StatCard`, actuellement présent en deux copies
**strictement identiques** (vérifié par `diff`, aucune différence) :

```text
apps/web/src/app/admin/_components/StatCard.tsx
apps/web/src/app/it/_components/StatCard.tsx
```

et en faire un composant réellement partagé dans `packages/ui`, conformément à la
convention documentée citée ci-dessus.

## Preuve / état actuel exact

**Contenu identique des deux fichiers** (56 lignes, `"use client"`, aucune dépendance
autre que `lucide-react` pour le type `LucideIcon`) :

```tsx
"use client";

import type { LucideIcon } from "lucide-react";

type StatCardStatus = "loading" | "ready" | "error" | "coming-soon";

interface StatCardProps {
  label: string;
  icon: LucideIcon;
  status: StatCardStatus;
  value?: string;
  delta?: string;
  deltaTone?: "positive" | "negative";
  errorMessage?: string;
}

export function StatCard({ label, icon: Icon, status, value, delta, deltaTone, errorMessage }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-5">
      <div className="mb-3 flex items-start justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-page text-navy">
          <Icon size={18} strokeWidth={1.75} />
        </span>
        {status === "ready" && delta && (
          <span
            className={`text-xs font-medium ${
              deltaTone === "negative" ? "text-status-red" : "text-status-green"
            }`}
          >
            {delta}
          </span>
        )}
      </div>

      <p className="text-sm text-navy/50">{label}</p>

      {status === "ready" && <p className="mt-1 text-2xl font-semibold text-navy">{value}</p>}

      {status === "loading" && (
        <div className="mt-2 h-7 w-16 animate-pulse rounded bg-navy/10" aria-label="Chargement…" />
      )}

      {status === "error" && (
        <p className="mt-1 text-sm text-status-red" title={errorMessage}>
          Erreur de chargement
        </p>
      )}

      {status === "coming-soon" && (
        <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">
          Bientôt disponible
        </p>
      )}
    </div>
  );
}
```

**Consommateurs actuels** (les deux seuls, tracés par recherche exhaustive) :
- `apps/web/src/app/admin/page.tsx:7` → `import { StatCard } from "./_components/StatCard";`, 4 usages (lignes 58, 59, 60, 69)
- `apps/web/src/app/it/page.tsx:14` → `import { StatCard } from "./_components/StatCard";`, 4 usages (lignes 105, 112, 119, 128)

**État actuel de `packages/ui/src/index.ts`** (à modifier) :
```ts
export { IssegLogo } from "./IssegLogo";
export { AppSidebar } from "./AppSidebar";
export type { AppSidebarItem, AppSidebarProps } from "./AppSidebar";
export { AppHeader } from "./AppHeader";
export type { AppHeaderProps } from "./AppHeader";
```

**Convention du package** : les composants existants (`AppHeader.tsx`, `IssegLogo.tsx`)
sont des fichiers `.tsx` à la racine de `packages/ui/src/`, exportés individuellement
depuis `index.ts` (composant + éventuel type de props). `AppHeader.tsx` porte
`"use client"` en première ligne, comme `StatCard.tsx` déjà.

## Étapes d'implémentation

### Étape 1 — Vérification préalable (lecture seule)

Avant toute modification, relire dans l'état courant du dépôt (au cas où il aurait
divergé depuis `aa4b86f`) :
- `apps/web/src/app/admin/_components/StatCard.tsx`
- `apps/web/src/app/it/_components/StatCard.tsx`
- `packages/ui/src/index.ts`

Confirmer que les deux `StatCard.tsx` sont toujours identiques (`diff` doit ne rien
retourner) avant de continuer. Si elles ont divergé, **arrêter et signaler** plutôt que
de choisir arbitrairement une version.

### Étape 2 — Création du composant partagé

Créer `packages/ui/src/StatCard.tsx` avec le contenu exact reproduit dans la section
"Preuve / état actuel exact" ci-dessus — **aucune modification fonctionnelle, visuelle,
ou de nommage**. Aucune nouvelle prop, aucun renommage de prop, aucune simplification.

### Étape 3 — Export

Ajouter à `packages/ui/src/index.ts`, à la suite des exports existants :

```ts
export { StatCard } from "./StatCard";
```

(Pas de type de props exporté séparément : `StatCardProps` et `StatCardStatus` sont
actuellement internes au fichier, non exportés dans les deux copies existantes — ne pas
en faire des exports publics sans que cela soit demandé, ce serait élargir l'API du
composant au-delà de l'existant.)

### Étape 4 — Migration `apps/web/src/app/admin/page.tsx`

Remplacer :
```ts
import { StatCard } from "./_components/StatCard";
```
par :
```ts
import { StatCard } from "@isseg/ui";
```
Les 4 usages de `<StatCard ... />` dans ce fichier restent inchangés (mêmes props,
mêmes valeurs).

Supprimer ensuite `apps/web/src/app/admin/_components/StatCard.tsx` — ce fichier ne
sert plus qu'à être remplacé par l'import partagé, aucune couche de réexport
intermédiaire n'est nécessaire (aucune convention existante dans ce dépôt n'impose un
tel wrapper pour `IssegLogo`, `AppSidebar` ou `AppHeader`, dont les consommateurs
importent directement `@isseg/ui`).

### Étape 5 — Migration `apps/web/src/app/it/page.tsx`

Même traitement :
```ts
import { StatCard } from "./_components/StatCard";
```
→
```ts
import { StatCard } from "@isseg/ui";
```
4 usages inchangés. Supprimer ensuite `apps/web/src/app/it/_components/StatCard.tsx`.

## Hors périmètre — ne pas toucher

- `AppSidebar.tsx`, `AppHeader.tsx`, `IssegLogo.tsx` (aucune modification)
- Les tokens Tailwind (`apps/web/tailwind.config.ts`)
- Les props de `StatCard` (aucun ajout, retrait, renommage)
- Le contenu/les valeurs affichées par les `StatCard` dans `admin/page.tsx` et
  `it/page.tsx` (labels, icônes, statuts — inchangés)
- Toute autre page de `/admin` ou `/it`
- `apps/web/src/app/it/_components/ItSidebar.tsx` (composant distinct, hors périmètre
  de ce plan)
- Le backend, les routes, les permissions
- Aucune nouvelle dépendance npm
- Aucun nettoyage opportuniste d'autres fichiers de `_components/` dans `admin` ou `it`

## Vérifications attendues après implémentation

1. **`tsc --noEmit`** (depuis `apps/web`, et si le monorepo le permet, vérifier aussi
   que `packages/ui` type-check sans erreur) → code de sortie `0`.
2. **`git status` / `git diff`** → doit montrer exactement :
   - 1 fichier créé : `packages/ui/src/StatCard.tsx`
   - 1 fichier modifié : `packages/ui/src/index.ts` (une ligne ajoutée)
   - 2 fichiers modifiés : `apps/web/src/app/admin/page.tsx`,
     `apps/web/src/app/it/page.tsx` (une ligne d'import chacun)
   - 2 fichiers supprimés : `apps/web/src/app/admin/_components/StatCard.tsx`,
     `apps/web/src/app/it/_components/StatCard.tsx`
   - Aucun autre fichier touché
3. **Test navigateur — Admin** : se connecter avec un compte `ADMIN`, ouvrir
   `/admin`, vérifier que les 4 `StatCard` du tableau de bord (Effectif total, Taux de
   paiement, Prêts bibliothèque, Tickets IT ouverts) s'affichent exactement comme
   avant (mêmes icônes, mêmes libellés, mêmes états `coming-soon`/valeur réelle),
   aucune erreur console.
4. **Test navigateur — `/it`** : se connecter avec `RESPONSABLE_IT`, ouvrir `/it`,
   vérifier que les 4 `StatCard` du tableau de bord (Requêtes ouvertes, Requêtes en
   cours, Postes disponibles, Requêtes du mois) s'affichent exactement comme avant,
   aucune erreur console.

## Critère de réussite

Le plan est terminé avec succès si : un seul composant `StatCard` existe dans le dépôt
(sous `packages/ui/src/StatCard.tsx`), les deux copies locales ont disparu, les deux
tableaux de bord (`/admin` et `/it`) s'affichent visuellement à l'identique de leur état
précédent, `tsc --noEmit` est à `0`, et le `git diff` correspond exactement à la liste
de fichiers de la section "Vérifications" ci-dessus.
