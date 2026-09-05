# Agent — Design responsive (apps/web)

Ce fichier définit une contrainte **transversale et obligatoire** pour tout écran ou
composant de `apps/web` (App Router Next.js 14, TailwindCSS) et de `packages/ui`,
quel que soit le module (Scolarité, Pédagogie, Bibliothèque, Départements, Innovation
Numérique, Finance/RH, Admin, Étudiant, Parent). Elle s'applique en plus des règles
propres à chaque domaine, pas à leur place.

## Origine

Audit du 2026-09-05 : `packages/ui/src/AppSidebar.tsx` (largeur fixe `w-64`, aucun
repli mobile) et `packages/ui/src/AppHeader.tsx` (recherche et identité utilisateur
toujours affichées en entier) rendaient `/enseignant` inutilisable sous 768px. Corrigé
dans la branche `feat/responsive-appshell`. Cette fiche formalise la règle pour que ça
ne se reproduise pas ailleurs.

## Obligation

Tout écran ou composant livré dans `apps/web` doit rester utilisable, sans overflow
horizontal de page ni chevauchement, à ces 3 tailles de référence :

| Taille | Largeur | Usage |
|---|---|---|
| Mobile | 375px | Référence iPhone SE / petits écrans Android |
| Tablette | 768px | Correspond exactement au breakpoint Tailwind `md` |
| Desktop | 1280px+ | Correspond au breakpoint Tailwind `xl` (`lg` = 1024px accepté comme palier intermédiaire) |

## Règles obligatoires

1. **Breakpoints Tailwind exclusivement** (`sm:`/`md:`/`lg:`/`xl:`). Interdiction des
   largeurs/hauteurs fixes en px (`w-64`, `h-screen` sur un conteneur de mise en page,
   valeurs arbitraires `w-[600px]`, etc.) sur les **conteneurs principaux** d'une page
   ou d'un composant partagé. Les tailles fixes restent légitimes sur des éléments qui
   ne sont pas des conteneurs de mise en page — icônes, avatars, badges (ex.
   `IssegLogo` avec `width={size} height={size}` sur un `<svg>`, ou un `<input
   type="number">` volontairement étroit).
2. **Tableaux de données** : deux options acceptées —
   - scroll horizontal contrôlé (`overflow-x-auto` sur un conteneur dédié, jamais un
     débordement qui casse la largeur de la page), **minimum acceptable** ;
   - vue mobile en cartes empilées sous `md`, table classique à partir de `md`
     (`hidden md:block` / `md:hidden`), **recommandé** dès que le tableau a plus de
     3-4 colonnes ou contient des actions par ligne.
3. **Formulaires multi-champs** : disposition en une seule colonne sous `md`
   (`grid-cols-1 md:grid-cols-2` ou équivalent), jamais de grille figée sur plusieurs
   colonnes qui s'applique aussi en dessous de `md`.
4. **AppSidebar / AppHeader (`@isseg/ui`)** : tout écran qui les utilise doit câbler le
   tiroir mobile — `AppSidebar` reçoit `mobileOpen`/`onMobileClose`, `AppHeader` reçoit
   `onMenuClick` (voir `apps/web/src/app/enseignant/page.tsx` pour l'exemple de
   référence). Ces props sont optionnelles côté composant pour ne pas casser un
   consommateur existant qui ne les fournirait pas encore, mais un nouvel écran ne
   doit **jamais** être livré sans elles si `AppSidebar` est utilisé. Un composant de
   navigation local à un module (ex. `ItSidebar`, `AdminSidebar`) doit suivre le même
   principe même s'il n'hérite pas directement de `AppSidebar`.
5. **Texte et contenu variable** (noms, rôles concaténés, libellés longs) : toujours
   `truncate` + `min-w-0` sur le conteneur flex/grid parent plutôt que de laisser le
   texte pousser la mise en page ou se chevaucher.

## Checklist avant toute PR touchant `apps/web` ou `packages/ui`

- [ ] Testé (ou raisonné à partir des classes Tailwind) à 375px, 768px et 1280px+
- [ ] Aucune largeur/hauteur fixe en px sur un conteneur principal de mise en page
- [ ] Aucun overflow horizontal non contrôlé (page entière) — un tableau large est
      dans un `overflow-x-auto` dédié, ou a une vue mobile en cartes
- [ ] Formulaire à plusieurs champs : une colonne sous `md`
- [ ] Si `AppSidebar`/`AppHeader` utilisés : tiroir mobile câblé
      (`mobileOpen`/`onMobileClose`/`onMenuClick`)
- [ ] Texte variable (noms, rôles, libellés) : `truncate`/`min-w-0`, pas de
      chevauchement possible avec un contenu long

## Limite connue de vérification en environnement CI/agent

Certains environnements d'exécution (fenêtre de navigateur à résolution fixe) ne
permettent pas de redimensionner réellement le viewport pour capturer une preuve
visuelle sous 768px. Dans ce cas, la vérification se fait par inspection directe des
classes Tailwind appliquées dans le DOM rendu (`getComputedStyle`, présence des
classes `md:*` attendues) plutôt que par capture d'écran — documenter cette limite
dans le message de commit plutôt que de prétendre à une vérification visuelle qui n'a
pas eu lieu. Une vérification manuelle sur un vrai appareil ou une fenêtre
redimensionnable reste recommandée avant mise en production si un doute subsiste.
