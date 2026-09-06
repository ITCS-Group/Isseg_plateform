# Plan — Aligner la navigation de `/admin/parametres` sur le Figma (onglets manquants)

## Contexte pour l'exécutant

Ce plan est autonome : il ne suppose aucune connaissance préalable de l'audit ou de la
conversation qui l'a produit. Toutes les informations nécessaires à l'implémentation
sont ci-dessous.

- **Dépôt** : `Isseg_plateform` (monorepo pnpm/Turborepo)
- **Branche à utiliser** : `feat/admin-parametres-tabs` (nouvelle branche dédiée, à créer
  depuis `main` à jour — `/admin/parametres` y existe déjà, chantier précédent mergé)
- **Application** : `apps/web` (Next.js 14, App Router, TailwindCSS) — chantier
  **purement frontend**, aucune migration ni endpoint backend créé ici (voir "Preuve"
  ci-dessous, c'est un choix délibéré, pas un oubli)

## Origine du finding

Comparaison de la maquette Figma Make de référence (`Portail de gestion académique`,
écran `AdminDashboard.tsx`, onglet "Paramètres") avec l'état actuel de
`/admin/parametres` (livré dans un chantier précédent, qui montait
`IdentityManagement.tsx`) : le Figma structure "Paramètres" en **3 onglets de premier
niveau** :

```tsx
{(["annee", "utilisateurs", "integrations"] as const).map((tab) => (
  // libellés : "Année académique" / "Utilisateurs & rôles" / "Intégrations"
))}
```

Le code actuel n'affiche que le contenu correspondant à un seul de ces trois onglets
("Utilisateurs & rôles", sous une forme différente : 3 sous-onglets
Utilisateurs/Rôles/Permissions) — sans la barre d'onglets de premier niveau, et sans les
deux autres sections ("Année académique", "Intégrations").

## Preuve / état actuel exact — pourquoi ce n'est PAS un simple oubli de code

**1. "Année académique" a un modèle de données réel, mais aucun endpoint** —
`apps/api/prisma/schema.prisma`, ligne 230 :
```prisma
model AnneeUniversitaire {
  id        String   @id @default(uuid())
  libelle   String   @unique
  dateDebut DateTime
  dateFin   DateTime
  estActive Boolean  @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  inscriptions        Inscription[]
  fraisScolarite      FraisScolarite[]
  dossiersInscription DossierInscription[]
  abandons            Abandon[]
}
```
Recherche exhaustive (`grep -rln "annee\|AnneeUniversitaire" apps/api/src
--include="*.controller.ts" -i`) : **aucun contrôleur ne l'expose**. La seule donnée
existante vient du seed (`AnneeUniversitaire démo: 2025-2026`). De plus, le Figma montre
un "Calendrier des étapes clés" (début inscriptions, clôture, début cours, examens,
délibérations...) et des actions "Archiver l'année" / "Créer l'année 2025-2026" — **aucun
de ces sous-concepts n'existe dans le schéma Prisma** (pas de table d'étapes, pas de
logique d'archivage). Construire cet onglet avec de vraies données nécessiterait un
chantier backend à part entière (nouveau contrôleur CRUD a minima, modélisation des
étapes clés, sémantique d'archivage à définir avec le métier) — hors périmètre de ce
plan, qui ne touche pas `apps/api`.

**2. "Intégrations" n'a aucun modèle, aucune trace dans le schéma** —
`grep -n "model.*Integration\|model.*Config\|Moodle\|Smtp\|SMS"
apps/api/prisma/schema.prisma -i` → **aucun résultat**. Dans le fichier Figma
Make lui-même, les 4 cartes d'intégration (Moodle LMS, SMTP, SMS Gateway, Stockage
cloud) sont pilotées par du `useState` local sans aucune donnée réelle
(`const [moodleEnabled, setMoodleEnabled] = useState(true)` etc.) — **même dans la
maquette, ce n'est qu'une simulation visuelle**, pas une intégration fonctionnelle.
`services/moodle-service` existe bien dans le monorepo mais comme microservice de
synchronisation (cf. CLAUDE.md), pas comme un réglage on/off piloté par un admin.

**3. Le pattern "placeholder honnête" existe déjà et documente sa propre philosophie** —
`apps/web/src/app/admin/_components/ComingSoonState.tsx` :
```tsx
/**
 * Placeholder honnête pour un widget du Figma dont la donnée réelle n'est pas
 * encore disponible côté backend (cf. backlog dans STATUT_MODULES.md). Le ton
 * reste positif ("Bientôt disponible") mais aucune valeur n'est inventée.
 */
```
Déjà utilisé 3 fois dans `apps/web/src/app/admin/page.tsx` pour exactement ce genre de
situation (widget du Figma sans données réelles derrière). C'est le même cas de figure
ici.

**4. État exact de `apps/web/src/app/admin/parametres/page.tsx`** (chantier précédent) :
```tsx
import { IdentityManagement } from "../_components/IdentityManagement";

export default function AdminParametresPage() {
  return <IdentityManagement />;
}
```
`IdentityManagement.tsx` gère elle-même sa propre barre d'onglets interne
(Utilisateurs/Rôles/Permissions, état `Tab` local) et son propre `<div className="p-6">`
englobant — voir `apps/web/src/app/admin/_components/IdentityManagement.tsx`, lignes
60-156 (état actuel, sans le commentaire de tête déjà retiré).

## Correction à apporter

### Décision de conception (à valider si tu n'es pas d'accord avant implémentation)

Ne pas toucher à `IdentityManagement.tsx` (déjà livré, testé, fonctionnel — pas de raison
de le modifier). Envelopper son affichage dans un nouvel onglet de premier niveau
"Utilisateurs & rôles" au lieu de le remplacer ou le restructurer. Conséquence visuelle
acceptée : quand cet onglet est actif, on verra la nouvelle barre d'onglets de premier
niveau **au-dessus** de la barre d'onglets interne existante d'`IdentityManagement`
(Utilisateurs/Rôles/Permissions) — deux niveaux de navigation empilés, pas fusionnés.
C'est un compromis délibéré pour ne rien casser de ce qui fonctionne déjà, pas une
maladresse.

### Étape unique — Réécrire `apps/web/src/app/admin/parametres/page.tsx`

```tsx
"use client";

import { useState } from "react";
import { IdentityManagement } from "../_components/IdentityManagement";
import { ComingSoonState } from "../_components/ComingSoonState";

type ParametresTab = "annee" | "utilisateurs" | "integrations";

const TABS: { key: ParametresTab; label: string }[] = [
  { key: "annee", label: "Année académique" },
  { key: "utilisateurs", label: "Utilisateurs & rôles" },
  { key: "integrations", label: "Intégrations" },
];

export default function AdminParametresPage() {
  const [tab, setTab] = useState<ParametresTab>("utilisateurs");

  return (
    <div className="p-6 pb-0">
      <div className="mb-2 flex w-fit gap-1 rounded-xl border border-navy/10 bg-page p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === t.key ? "bg-white text-navy shadow-sm" : "text-navy/50 hover:text-navy"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "annee" && (
        <div className="p-6 pt-4">
          <ComingSoonState message="Le modèle AnneeUniversitaire existe côté base de données, mais aucun endpoint ne l'expose encore, et le calendrier des étapes clés (inscriptions, examens, délibérations) n'est pas modélisé. Nécessite un chantier backend dédié." />
        </div>
      )}

      {tab === "utilisateurs" && <IdentityManagement />}

      {tab === "integrations" && (
        <div className="p-6 pt-4">
          <ComingSoonState message="Aucune intégration (Moodle, SMTP, SMS, stockage) n'est aujourd'hui pilotable depuis l'administration — la synchronisation Moodle existe comme service technique séparé (services/moodle-service), pas comme réglage on/off pour un admin." />
        </div>
      )}
    </div>
  );
}
```

Le tab par défaut est `"utilisateurs"` pour ne pas changer le comportement perçu par un
admin qui ouvrait déjà cette page avant ce chantier (il voyait directement la gestion des
utilisateurs).

`"use client"` devient nécessaire ici (état `useState` local pour l'onglet actif) — ce
n'était pas le cas dans la version précédente du fichier.

## Hors périmètre — ne pas toucher

- `IdentityManagement.tsx` : aucune modification (ni son contenu, ni sa barre d'onglets
  interne, ni son `<div className="p-6">` — le double niveau de padding/onglets est un
  compromis assumé, voir "Décision de conception" ci-dessus).
- `ComingSoonState.tsx` : réutilisé tel quel, aucune modification.
- Le backend (`apps/api`) : aucun endpoint créé pour `AnneeUniversitaire`, aucun modèle
  d'intégrations ajouté au schéma Prisma. Si ce besoin devient réel, c'est un chantier
  backend séparé (et une branche séparée, jamais mélangée avec du frontend).
- `AdminSidebar.tsx`, `AdminHeader.tsx`, `admin/layout.tsx`, `admin/page.tsx` (le tableau
  de bord) : inchangés.
- Toute autre page de `/admin` ou `/it`.
- Aucune nouvelle dépendance npm.

## Vérifications attendues après implémentation

1. **`tsc --noEmit`** (depuis `apps/web`) → code de sortie `0`.
2. **`git status` / `git diff`** → doit montrer exactement 1 fichier modifié :
   `apps/web/src/app/admin/parametres/page.tsx`. Aucun autre fichier touché.
3. **Test navigateur** (compte `ADMIN`) :
   - Ouvrir `/admin/parametres` → l'onglet "Utilisateurs & rôles" est actif par défaut,
     comportement identique à avant (Utilisateurs/Rôles/Permissions fonctionnels,
     données réelles, pagination).
   - Cliquer sur "Année académique" → message "Bientôt disponible" affiché, avec le
     texte explicatif ci-dessus.
   - Cliquer sur "Intégrations" → même chose.
   - Revenir sur "Utilisateurs & rôles" → toujours fonctionnel (pas de perte d'état
     grave attendue, un simple re-render est acceptable).
   - Aucune erreur console sur les trois onglets.

## Critère de réussite

Le plan est terminé avec succès si : la barre d'onglets de premier niveau de
`/admin/parametres` reflète exactement les 3 onglets du Figma (mêmes libellés), les deux
onglets sans backend affichent un placeholder honnête et spécifique (pas un texte
générique, pas de fausse donnée), l'onglet "Utilisateurs & rôles" continue de fonctionner
exactement comme avant, `tsc --noEmit` est à `0`, et le `git diff` ne touche qu'un seul
fichier.
