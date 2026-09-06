# Plan 2I-1 — Cohérence visuelle du bouton "Clôturer" (dialogue de confirmation)

## Contexte pour l'exécutant

Ce plan est autonome : il ne suppose aucune connaissance préalable de l'audit ou de la
conversation qui l'a produit. Toutes les informations nécessaires à l'implémentation
sont ci-dessous.

- **Dépôt** : `Isseg_plateform` (monorepo pnpm/Turborepo)
- **Branche à utiliser** : `feat/support-it-frontend`
- **Commit de référence au moment de l'audit** : `aa4b86f` (`feat(support-it): portail
  /it complet (dashboard, listes, détails, actions métier)`)
- **Application** : `apps/web` (Next.js 14, App Router, TailwindCSS)
- **Fichier concerné (unique)** : `apps/web/src/app/it/requetes/[id]/page.tsx`

## Objectif

Corriger une incohérence visuelle : le même libellé **"Clôturer"**, pour la **même
action métier**, dans le **même flux utilisateur** (ouvrir une requête → cliquer sur le
bouton déclencheur → confirmer dans le dialogue), est actuellement rendu avec deux
styles de bouton différents et sans justification documentée.

## Preuve / état actuel exact

Dans `apps/web/src/app/it/requetes/[id]/page.tsx` (au commit `aa4b86f`) :

**Bouton déclencheur** (ligne ~166-172, dans la carte d'info de la requête) :
```tsx
<button
  type="button"
  onClick={() => setShowConfirmCloture(true)}
  disabled={clotureStatus === "loading"}
  className="rounded border border-navy/20 px-3 py-1 text-xs font-medium text-navy disabled:opacity-40"
>
  {clotureStatus === "loading" ? "Clôture…" : "Clôturer"}
</button>
```

**Bouton de confirmation du dialogue** (ligne ~314-327, dans le bloc
`{showConfirmCloture && (...)}`) :
```tsx
<div className="mt-4 flex justify-end gap-2">
  <button
    type="button"
    onClick={() => setShowConfirmCloture(false)}
    className="rounded border border-navy/20 px-3 py-1 text-sm text-navy"
  >
    Annuler
  </button>
  <button
    type="button"
    onClick={confirmCloturer}
    className="rounded-lg bg-gold px-3 py-1 text-sm font-semibold text-navy transition-opacity hover:opacity-90"
  >
    Clôturer
  </button>
</div>
```

Le style `rounded-lg bg-gold ... font-semibold ... hover:opacity-90` du bouton de
confirmation est un cas **isolé** sur toute la surface `/it` : tous les autres boutons
de soumission de la même surface (`Créer un cours`, `Créer un poste`, `Ajouter une
intervention`, `Valider l'évaluation`, le bouton déclencheur `Clôturer` lui-même, et le
bouton `Annuler` juste à côté) utilisent la variante `rounded border border-navy/20 ...
text-navy` (avec ou sans `text-xs`/`text-sm`, `font-medium`, `disabled:opacity-40`
selon le contexte). Aucun commentaire ni document du dépôt (`.claude/CLAUDE.md`, aucun
`DESIGN.md` présent) ne justifie un traitement distinct pour un bouton de confirmation
de dialogue.

## Correction à apporter

**Une seule modification** : remplacer la valeur de l'attribut `className` du bouton de
confirmation ("Clôturer", `onClick={confirmCloturer}`) par le style déjà utilisé par le
bouton `Annuler` juste au-dessus :

```diff
- className="rounded-lg bg-gold px-3 py-1 text-sm font-semibold text-navy transition-opacity hover:opacity-90"
+ className="rounded border border-navy/20 px-3 py-1 text-sm text-navy"
```

C'est la valeur exacte du bouton `Annuler` adjacent (ligne ~318 ci-dessus) — pas une
nouvelle valeur inventée.

## Hors périmètre — ne pas toucher

- La logique de clôture (`confirmCloturer`, `handleCloturer`, l'appel
  `PATCH /requetes/:id/cloturer`)
- L'état `clotureStatus` / `clotureError`
- Le bouton déclencheur "Clôturer" (déjà dans le style cible, ne rien changer)
- Le texte du dialogue ("Voulez-vous vraiment clôturer cette requête ?...")
- Le bouton "Annuler" (déjà dans le style cible, ne rien changer — il sert de référence,
  pas de cible de modification)
- Les permissions (`hasCapability(...)`)
- Toute autre page de `/it`, `packages/ui`, ou tout fichier backend
- Le design system (`tailwind.config.ts`), les tokens, `AppSidebar`, `AppHeader`

## Vérifications attendues après implémentation

1. **`tsc --noEmit`** (depuis `apps/web`) → doit terminer avec le code de sortie `0`,
   aucune erreur.
2. **`git status` / `git diff`** → une seule ligne modifiée (la valeur de `className`
   ci-dessus), un seul fichier touché
   (`apps/web/src/app/it/requetes/[id]/page.tsx`).
3. **Test navigateur** (avec un compte `RESPONSABLE_IT` ou `ADMIN`, seuls rôles
   voyant ce bouton — voir `hasCapability(user.roles, "requetes", "cloturer")`) :
   - Se connecter, ouvrir `/it/requetes`, ouvrir le détail d'une requête non
     `CLOTUREE`
   - Cliquer sur "Clôturer" (bouton déclencheur) → le dialogue de confirmation
     s'affiche
   - Vérifier visuellement que le bouton "Clôturer" du dialogue a désormais le même
     traitement (bordure fine, fond blanc, texte navy) que le bouton "Annuler" juste à
     côté — plus de fond doré
   - Cliquer sur "Clôturer" dans le dialogue → vérifier que l'action fonctionne
     toujours normalement (statut de la requête passe à `CLOTUREE`, `dateCloture`
     renseignée, re-fetch, dialogue se ferme) — **le comportement fonctionnel ne doit
     pas changer**, seul le style visuel change
   - Vérifier l'absence d'erreur dans la console du navigateur

## Critère de réussite

Le plan est terminé avec succès si : le bouton de confirmation du dialogue "Clôturer"
partage visuellement le même style que les autres boutons de soumission de `/it`, la
clôture d'une requête fonctionne toujours normalement, `tsc --noEmit` est à `0`, et
`git diff` ne montre qu'un seul changement de `className` dans un seul fichier.
