# Statut des modules — ISSEG Platform

Ce fichier distingue explicitement **"rôle testé côté authentification"** de
**"fonctionnalité métier livrée"** — ce sont deux choses différentes, et cette
distinction s'est révélée nécessaire après l'ajout des 11 rôles RBAC listés
dans `CLAUDE.md` sans module métier derrière (chantier `feature/rbac-full-roles`).

## Rôles opérationnels côté authentification, en attente du module métier

Pour chacun des rôles suivants : le rôle existe en base (`Role`), un compte de
test peut se connecter (`POST /api/v1/auth/login`), obtient un JWT contenant
le bon rôle, `GET /api/v1/auth/me` le confirme, et les guards RBAC existants
le rejettent correctement (403) sur toutes les routes métier actuelles
(Scolarité, Pédagogie, Identity) — **aucune de ces routes ne le concerne**.

**Aucune route métier n'existe encore pour ces rôles.** Se connecter avec un
de ces comptes ne donne accès à rien de plus que `GET /auth/me` — c'est
attendu, pas un bug.

| Rôle | Compte de test | Module métier associé | État du module métier |
|---|---|---|---|
| `SUPER_ADMIN` | `super_admin@isseg.local` | (aucun — traité comme identique à `ADMIN` pour l'instant, même absence de permission ; à différencier plus tard si un besoin métier concret apparaît) | N/A |
| `COMPTABLE` | `comptable@isseg.local` | Finance/RH | Non implémenté (aucun code) |
| `RH` | `rh@isseg.local` | Finance/RH | Non implémenté (aucun code) |
| `DIRECTEUR_GENERAL` | `directeur_general@isseg.local` | Grand Conseil (validation finale des notes) | Non implémenté — dépend de l'arbitrage non tranché sur la propriété du workflow de validation à 5 étapes (cf. audits précédents) |
| `DIRECTEUR_INNOVATION` | `directeur_innovation@isseg.local` | Innovation Numérique | Non implémenté (agent `agent-innovation-numerique.md` non committé, non arbitré) |
| `RESPONSABLE_PUBLICATIONS` | `responsable_publications@isseg.local` | Innovation Numérique (Éditions) | Non implémenté |
| `RESPONSABLE_IT` | `responsable_it@isseg.local` | Innovation Numérique (Support Informatique) | Non implémenté |
| `PARENT` | `parent@isseg.local` | Portail Parent | Non implémenté |

Mot de passe de tous les comptes ci-dessus : identique au reste des comptes de
test (`ChangeMe123!`, temporaire — cf. `apps/api/prisma/seed.ts`).

## Pour rappel — rôles avec module métier réel derrière

| Rôle | Module métier | État |
|---|---|---|
| `ADMIN` | Identity (users/roles/permissions) | ✅ Livré |
| `SCOLARITE` | Scolarité (inscription) | Backend livré, aucun écran frontend |
| `ENSEIGNANT` | Pédagogie (cours/notes) | ✅ Livré (backend + frontend `/teacher`) |
| `CHEF_DEPARTEMENT` | Pédagogie (lecture seule) | Backend livré (lecture), aucun écran dédié |
| `DGA_ETUDES` | Pédagogie (lecture + écriture) | Backend livré, aucun écran dédié |
| `BIBLIOTHECAIRE` | Bibliothèque (catalogue, emprunts, abonnés) | ✅ Backend livré (`feature/bibliotheque`, 19-20/08) : `SectionBibliotheque`/`Ouvrage`/`Emprunt`/`Abonne`/`DocumentAcademique`/`Reservation`, endpoints `/ouvrages`, `/emprunts`(+`/retour`), `/abonnes`, `/bibliotheque/stats/dashboard`. Aucun écran frontend. |
| `RESPONSABLE_BIBLIOTHEQUE` | Bibliothèque (supervision — mêmes routes que BIBLIOTHECAIRE) | ✅ Backend livré (même chantier) — rôle distinct, pas fusionné dans `BIBLIOTHECAIRE`/`ADMIN` (décision explicite). Compte de test : `responsable_bibliotheque@isseg.local`. Aucun écran frontend. |
| `RESPONSABLE_NUMERISATION` | Bibliothèque (documents académiques — thèses/mémoires) | ✅ Backend livré (même chantier) : `/documents-academiques` (CRUD, visibilité conditionnée à `diffusionAutorisee`/embargo). Aucun écran frontend. |
| `ETUDIANT` | Bibliothèque (lecture catalogue, emprunt, réservation) | ✅ Backend livré (même chantier) pour la partie Bibliothèque uniquement : `GET /ouvrages`, `GET /emprunts` (scopé à ses propres emprunts), `POST /reservations`, lecture `/documents-academiques` diffusés. Le **Portail Étudiant** plus large (profil, notes, autres documents) reste non implémenté — aucun écran frontend dans les deux cas. |

## Règle de mise à jour

Quand un module métier est livré pour un rôle listé dans la première section,
**déplacer la ligne correspondante** vers la seconde section avec son état
réel — ne jamais laisser une ligne dans "en attente" une fois qu'une route
métier existe pour ce rôle, et ne jamais marquer un rôle "livré" tant que
seule l'authentification a été testée.
