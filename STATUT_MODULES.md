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
| `PARENT` | `parent@isseg.local` | Portail Parent | Non implémenté |

Mot de passe de tous les comptes ci-dessus : identique au reste des comptes de
test (`ChangeMe123!`, temporaire — cf. `apps/api/prisma/seed.ts`).

## Pour rappel — rôles avec module métier réel derrière

| Rôle | Module métier | État |
|---|---|---|
| `ADMIN` | Identity (users/roles/permissions) | ✅ Livré |
| `SCOLARITE` | Scolarité (inscription) | Backend livré, aucun écran frontend. Actions du workflow (`/dossiers-inscription/:id/{submit,start-processing,register,reject}`) + lecture (`GET /dossiers-inscription` listing paginé, `GET /dossiers-inscription/stats` effectif INSCRIT) — les deux endpoints de lecture scopés à l'année universitaire active (`estActive=true`), chantier `feat/scolarite-inscriptions-listing`, 22/08. |
| `ENSEIGNANT` | Pédagogie (cours/notes) | ✅ Livré (backend + frontend `/enseignant`, renommé depuis `/teacher` le 21/08) |
| `CHEF_DEPARTEMENT` | Pédagogie (lecture seule) | Backend livré (lecture), aucun écran dédié |
| `DGA_ETUDES` | Pédagogie (lecture + écriture) | Backend livré, aucun écran dédié |
| `BIBLIOTHECAIRE` | Bibliothèque (catalogue, emprunts, abonnés) | ✅ Backend livré (`feature/bibliotheque`, 19-20/08) : `SectionBibliotheque`/`Ouvrage`/`Emprunt`/`Abonne`/`DocumentAcademique`/`Reservation`, endpoints `/ouvrages`, `/emprunts`(+`/retour`), `/abonnes`, `/bibliotheque/stats/dashboard`. Aucun écran frontend. |
| `RESPONSABLE_BIBLIOTHEQUE` | Bibliothèque (supervision — mêmes routes que BIBLIOTHECAIRE) | ✅ Backend livré (même chantier) — rôle distinct, pas fusionné dans `BIBLIOTHECAIRE`/`ADMIN` (décision explicite). Compte de test : `responsable_bibliotheque@isseg.local`. Aucun écran frontend. |
| `RESPONSABLE_NUMERISATION` | Bibliothèque (documents académiques — thèses/mémoires) | ✅ Backend livré (même chantier) : `/documents-academiques` (CRUD, visibilité conditionnée à `diffusionAutorisee`/embargo). Aucun écran frontend. |
| `ETUDIANT` | Bibliothèque (lecture catalogue, réservation) | ✅ Backend livré (même chantier) pour la partie Bibliothèque uniquement : `GET /ouvrages`, `GET /emprunts` (scopé à ses propres emprunts, actuellement toujours vide), `POST /reservations`, lecture `/documents-academiques` diffusés. **Ne peut plus emprunter à domicile depuis le 20/08** (restriction ENSEIGNANT-only, réactivable par configuration sans nouveau code). Le **Portail Étudiant** plus large (profil, notes, autres documents) reste non implémenté — aucun écran frontend dans les deux cas. |
| `RESPONSABLE_IT` | Support Informatique (supervision — tous sous-services) | ✅ Backend livré (`feat/support-it-module`, 25-26/08) : `Requete`/`Intervention`/`Technicien`/`CoursSupportIT`/`InscriptionCoursSupportIT`/`EvaluationSupportIT`/`Poste`, endpoints `/requetes`(+`/cloturer`), `/requetes/:id/interventions`, `/cours-support-it`(+`/inscriptions`), `/inscriptions-support-it`(+`/evaluation`), `/postes`(+`/statut`, `/stats/disponibilite`), `/support-it/stats/synthese-mensuelle`. Sort d'auth-only à cette occasion. Aucun écran frontend. |
| `TECHNICIEN` | Support Informatique (traitement des requêtes de son sous-service) | ✅ Backend livré (même chantier) — rôle nouveau, distinct de `RESPONSABLE_IT` (spécialisation de `Personnel`, `Technicien.sousService`). Compte de test : `technicien@isseg.local`. Aucun écran frontend. |

**Attestation Support IT — forme provisoire** : `AttestationService`
(`apps/api/src/support-it/attestations/`) génère un objet structuré (pas
de PDF) avec un unique gabarit texte codé en dur, aucune signature,
aucune numérotation officielle réelle — voir le commentaire de tête dans
`attestation.types.ts`. Scopé à Support IT uniquement, volontairement pas
un service de certification générique. À généraliser (multi-templates,
signature, numérotation officielle) seulement quand le Centre
d'Innovation Pédagogique fournira un second cas d'usage réel — ne pas
anticiper cette forme finale avant.

**Migration Prisma du module Support IT** : appliquée sur `isseg_test`
uniquement à ce stade (25/08). **Pas encore appliquée sur `isseg`
(dev)** — attend le feu vert explicite de l'utilisateur, comme pour tous
les chantiers précédents. Supprime aussi l'ancien modèle `Message`
(Parent), mort et jamais branché (0 ligne en base, vérifié avant
suppression), remplacé par `MessageInterne` — module transverse
(`apps/api/src/messagerie/`), hors périmètre Support IT, ouvert à tout
compte authentifié.

## Backlog — endpoints manquants pour le Dashboard Admin (`/admin`)

Identifié lors de l'audit de correspondance Figma ↔ backend du chantier
`feat/dashboards-phase8-etape2-admin` (2026-08-21), pour ne pas refaire cette
analyse depuis zéro au prochain chantier sur `/admin`. Le Dashboard Admin
(StatCards + graphique + tableaux) affiche actuellement un état "Bientôt
disponible" pour chacune des lignes ci-dessous, tant qu'aucun endpoint réel
n'existe — voir `apps/web/src/app/admin/page.tsx`.

| Widget Figma | Donnée manquante | Endpoint à créer (proposition) | Remarque |
|---|---|---|---|
| StatCard "Effectif total" | Agrégat du nombre d'étudiants inscrits | `GET /dossiers-inscription/stats` (ou équivalent) | Aucun `GET` de listing/comptage n'existe sur `dossiers-inscription` aujourd'hui — le controller n'expose que les actions du workflow (submit/start-processing/register/reject) |
| StatCard "Taux de paiement" | Agrégat du taux de régularité financière sur l'ensemble des étudiants | Endpoint d'agrégation à créer, ex. `GET /scolarite/stats/paiements` | La donnée métier "régularité" existe déjà **par étudiant** (`GET /etudiants/:matricule/statut-regularite`), mais aucun rollup global n'existe — ne pas confondre avec un module Finance à créer de zéro, c'est un agrégat manquant sur une donnée qui existe déjà unitairement |
| Graphique "Inscriptions/abandons par mois" | Agrégat mensuel des inscriptions et abandons | Endpoint d'agrégat temporel à créer, ex. `GET /dossiers-inscription/stats/mensuel` | Le concept "abandon" (dropout) n'est a priori pas modélisé dans le schéma Prisma actuel — à vérifier/statuer avant de créer l'endpoint |
| Tableau "Inscriptions récentes" | Listing des dossiers d'inscription les plus récents | `GET /dossiers-inscription` (listing paginé) | Même cause racine que l'"Effectif total" — aucun GET de listing n'existe sur ce controller |

**Déjà branché réellement** : StatCard "Prêts bibliothèque" ← `GET /bibliotheque/stats/dashboard` (`empruntsEnCours`/`empruntsEnRetard`) ; StatCard "Tickets IT ouverts" + Tableau "Tickets IT récents" ← module Support IT désormais livré (`GET /requetes?statut=OUVERTE` pour le comptage/listing, `GET /support-it/stats/synthese-mensuelle` pour la ventilation par sous-service) — aucun écran frontend ne les consomme encore.

## Points techniques à surveiller

- **`emprunt.service.integration-spec.ts` — test "quota atteint (10 emprunts en
  cours pour un ENSEIGNANT) : refus" fragile aux conditions réseau du moment**
  (observé 22/08, chantier `feat/scolarite-inscriptions-listing`, deux
  échecs reproductibles au même endroit lors de l'exécution complète de la
  suite d'intégration). Root cause : le test enchaîne 10 créations
  d'emprunt **séquentielles** pour atteindre le quota ; avec la latence Neon
  observée ce jour-là (3 à 9 s par création), le total dépasse le timeout
  Jest par défaut de 30 s. **Ce n'est pas un défaut du code** (le service
  fonctionne correctement — les 9 autres tests de la même suite passent,
  et le comportement métier n'est pas en cause), c'est un test dont le
  budget de temps ne tient pas compte de la latence réseau variable de la
  base de test distante. Pas un chantier à ouvrir maintenant — deux pistes
  à trancher plus tard : augmenter le timeout de ce test spécifique, ou
  paralléliser les 10 créations (`Promise.all`) pour réduire le temps total.
  Même symptôme reproduit le 26/08 sur
  `stats.service.integration-spec.ts` (chantier `feat/support-it-module`,
  ~12 allers-retours séquentiels) — corrigé cette fois en appliquant la
  première piste (timeout de test étendu à 120s), succès confirmé en ~8s
  au ré-essai.

## Notes opérationnelles

- **Token API Moodle** généré le 25/08/2026, expire le 24/09/2026 — à
  régénérer avant cette date si le client Moodle (`MoodleClientService`)
  doit être branché. Procédure complète :
  `services/moodle-service/SETUP.md` § 7.5.

## Règle de mise à jour

Quand un module métier est livré pour un rôle listé dans la première section,
**déplacer la ligne correspondante** vers la seconde section avec son état
réel — ne jamais laisser une ligne dans "en attente" une fois qu'une route
métier existe pour ce rôle, et ne jamais marquer un rôle "livré" tant que
seule l'authentification a été testée.
