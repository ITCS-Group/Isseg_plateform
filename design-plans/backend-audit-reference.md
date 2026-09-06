# Référence technique — Backend ISSEG (`apps/api`)

> **Nature du document** : référence technique factuelle, **pas un plan d'implémentation**.
> Établi par l'audit Phase 0 + passe ciblée Phase 0.1, consolidé en Phase 0.2.
> Date de l'état constaté : 2026-09-05, sur `main` au commit `7cae264`.
> Toute donnée ci-dessous provient d'une lecture directe du code, jamais d'une déduction.

---

## A. État global

| Élément | Valeur constatée |
|---|---|
| Backend principal | `apps/api` — NestJS 10 |
| ORM / base | Prisma 5.22.0 (client aligné sur CLI) / PostgreSQL |
| Préfixe des routes | `setGlobalPrefix('api')` + `enableVersioning({ type: URI, defaultVersion: '1' })` → **`/api/v1/...`** (`apps/api/src/main.ts:31-32`) |
| Modules NestJS | **30** fichiers `*.module.ts` |
| Controllers | **24** (pour 22 préfixes distincts) |
| Endpoints HTTP | **88** (39 GET · 30 POST · 10 PATCH · 9 DELETE) |
| Services | **26** (dont `prisma.service.ts`) |
| Modèles Prisma | **46** |
| Enums Prisma | **19** |
| Migrations | 7 |
| Tests | 30 fichiers unitaires (386 tests, 100 % PASS) · 17 suites d'intégration (141/142 PASS — l'échec unique est une coupure réseau Neon transitoire, pas un défaut de code) |
| Auth / RBAC | Conforme aux décisions validées (détail §H) — mais RBAC effectif **par rôle uniquement**, cf. CONTRA-04 |
| Pagination | **10 endpoints paginés / 9 endpoints de collection non paginés** (détail §E) |
| AuditLog | Utilisé **uniquement** pour l'authentification (3 appels) — cf. §G et CONTRA-01 |
| Interceptors / pipes custom | **Aucun** dans tout le backend |

**Chaîne de guards globaux** (`app.module.ts`, dans cet ordre) :
`ThrottlerGuard` → `JwtAuthGuard` → `RolesGuard` → `PermissionsGuard`.

**Rate limiting** : 100 req/min global · 5/min sur `POST /auth/login` · 10/min sur `POST /auth/refresh`.

**Validation** : `ValidationPipe` global avec `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` → tout champ non déclaré dans un DTO est **rejeté**, pas ignoré.

**Gestion d'erreurs** : `AllExceptionsFilter` global, mappe les codes Prisma (`P2002` → 409, `P2025` → 404) sans exposer de stack trace ni de noms de tables/colonnes.

---

## B. Matrice complète des modules

Légende statut : `COMPLET` (code + tests unitaires + intégration) · `PARTIEL` (manque une couche de tests) · `MINIMAL` (aucun test) · `ORPHELIN` (non exposé).

| Module | Fichier module | Controller(s) | Service(s) | DTOs utilisés | Prisma (modèles) | Guards / Rôles / Permissions | Tests | Statut |
|---|---|---|---|---|---|---|---|---|
| **AppModule** | `src/app.module.ts` | — | — | — | — | Déclare les 4 guards globaux | — | COMPLET |
| **PrismaModule** | `src/database/prisma/prisma.module.ts` | — | `prisma.service.ts` | — | (client) | module global, non protégé | aucun | COMPLET |
| **AuthModule** | `src/auth/auth.module.ts` | `auth.controller.ts` | `auth.service.ts` | `login`, `refresh-token`, `access-token.response`, `user-profile.response` | `utilisateur`, `refreshToken`, `auditLog` | `@Public()` ×2 · `@Throttle` ×2 · stratégies `jwt`/`local` · **définit** les guards `jwt-auth`, `roles`, `permissions` · perms : aucune | U: `roles.guard.spec` · I: `auth.service.integration-spec` | COMPLET |
| **IdentityModule** | `src/identity/identity.module.ts` | — (agrégateur) | — | — | — | — | — | COMPLET |
| ├ **UsersModule** | `src/identity/users/users.module.ts` | `users.controller.ts` | `users.service.ts` | `create-user`, `update-user`, `query-user`, `change-password`, `user.response` | `utilisateur`, `role`, `utilisateurRole` | classe `@Roles('ADMIN')` ; `GET`/`GET :id` élargis à `ADMIN,SCOLARITE` · perms : aucune | **aucun** | PARTIEL |
| ├ **RolesModule** | `src/identity/roles/roles.module.ts` | `roles.controller.ts` | `roles.service.ts` | `create-role`, `update-role`, `role.response` | `role`, `permission`, `rolePermission`, `utilisateurRole` | classe `@Roles('ADMIN')` · perms : aucune | **aucun** | PARTIEL |
| └ **PermissionsModule** | `src/identity/permissions/permissions.module.ts` | `permissions.controller.ts` | `permissions.service.ts` | `create-permission`, `update-permission`, `permission.response` | `permission`, `rolePermission` | classe `@Roles('ADMIN')` · perms : aucune | **aucun** | PARTIEL |
| **RegistrationModule** | `src/scolarite/registration/registration.module.ts` | `registration.controller.ts` | `registration-workflow.service.ts`, `dossier-inscription-query.service.ts` | `query-dossier-inscription`, `transition`, `reject-dossier`, `dossier-inscription.response`, `transition-result.response`, `dossier-inscription-stats.response` | `dossierInscription`, `etudiant`, `abonne`, `registrationHistory`, `outboxEvent`, `anneeUniversitaire` | classe `@Roles('SCOLARITE','ADMIN')` · perms : aucune | U ×4 · I ×2 | COMPLET |
| **RegularityModule** | `src/scolarite/regularity/regularity.module.ts` | `regularity.controller.ts` | `regularity.service.ts` | `regularity-status.response` | `etudiant` | classe `@Roles('ADMIN','SCOLARITE','BIBLIOTHECAIRE')` · perms : aucune | U ×1 · I ×1 | COMPLET |
| **AbandonModule** | `src/scolarite/abandon/abandon.module.ts` | `abandon.controller.ts` | `abandon.service.ts` | `query-abandon`, `signaler-abandon`, `decider-reprise`, `abandon.response`, `abandon-list.response` | `abandon`, `inscription` | classe `@Roles('SCOLARITE','ADMIN')` · perms : aucune | U ×2 · I ×1 | COMPLET |
| **PedagogieModule** | `src/pedagogie/pedagogie.module.ts` | — (agrégateur) | — | — | — | — | — | COMPLET |
| ├ **CoursClasseModule** | `src/pedagogie/cours-classe/cours-classe.module.ts` | `cours-classe.controller.ts` | `cours-classe.service.ts` | `create-cours-classe`, `list-cours-classe-query`, `cours-classe.response` | `coursClasse`, `coursScenarise`, `classe`, `enseignant`, `epreuve` | classe `@Roles('ADMIN')` + surcharges méthode · perms : aucune | U ×1 · I ×1 | COMPLET |
| ├ **EpreuveModule** | `src/pedagogie/epreuve/epreuve.module.ts` | `epreuve.controller.ts` | `epreuve.service.ts` | `create-epreuve`, `list-epreuve-query`, `epreuve.response` | `epreuve`, `coursClasse`, `noteEtudiant` | classe `@Roles('ADMIN')` + surcharges · perms : aucune | U ×4 · I ×1 | COMPLET |
| └ **NoteEtudiantModule** | `src/pedagogie/note-etudiant/note-etudiant.module.ts` | `note-etudiant.controller.ts` | `note-etudiant.service.ts` | `create-note-etudiant`, `update-note-etudiant`, `list-note-etudiant-query`, `note-etudiant.response` | `noteEtudiant`, `noteEtudiantHistory`, `epreuve`, `inscription`, `enseignant` | classe `@Roles('ADMIN')` + surcharges · perms : aucune | U ×2 · I ×1 | COMPLET |
| **BibliothequeModule** | `src/bibliotheque/bibliotheque.module.ts` | — (agrégateur) | — | — | — | — | — | COMPLET |
| ├ **OuvrageModule** | `src/bibliotheque/ouvrages/ouvrage.module.ts` | `ouvrage.controller.ts` | `ouvrage.service.ts` | `create-ouvrage`, `update-ouvrage`, `list-ouvrage-query`, `ouvrage.response` | `ouvrage`, `sectionBibliotheque`, `emprunt` | classe : 5 rôles (gestion + `ETUDIANT`,`ENSEIGNANT`) ; mutations restreintes aux 3 rôles de gestion · perms : aucune | U ×1 | PARTIEL |
| ├ **AbonneModule** | `src/bibliotheque/abonnes/abonne.module.ts` | `abonne.controller.ts` | `abonne.service.ts` | `create-abonne`, `abonne.response` | `abonne`, `utilisateur` | classe `@Roles('ADMIN','BIBLIOTHECAIRE','RESPONSABLE_BIBLIOTHEQUE')` · perms : aucune | U ×1 | PARTIEL |
| ├ **EmpruntModule** | `src/bibliotheque/emprunts/emprunt.module.ts` | `emprunt.controller.ts` | `emprunt.service.ts` | `create-emprunt`, `list-emprunt-query`, `emprunt.response` | `emprunt`, `ouvrage`, `abonne`, `etudiant` | classe : 5 rôles ; POST/PATCH restreints aux 3 rôles de gestion · perms : aucune | U ×1 · I ×1 | COMPLET |
| ├ **ReservationModule** | `src/bibliotheque/reservations/reservation.module.ts` | `reservation.controller.ts` | `reservation.service.ts` | `create-reservation`, `reservation.response` | `reservation`, `ouvrage`, `abonne` | classe `@Roles('ETUDIANT','ENSEIGNANT')` · perms : aucune | U ×1 | PARTIEL |
| ├ **DocumentAcademiqueModule** | `src/bibliotheque/documents-academiques/document-academique.module.ts` | `document-academique.controller.ts` | `document-academique.service.ts` | `create-document-academique`, `update-document-academique`, `list-document-academique-query`, `document-academique.response` | `documentAcademique`, `etudiant`, `enseignant` | classe : 4 rôles ; POST/PATCH restreints à `ADMIN`,`RESPONSABLE_NUMERISATION` · perms : aucune | U ×1 | PARTIEL |
| └ **StatsModule (biblio)** | `src/bibliotheque/stats/stats.module.ts` | `stats.controller.ts` | `stats.service.ts` | `bibliotheque-stats.response` | `ouvrage`, `emprunt`, `reservation`, `abonne`, `documentAcademique` | classe `@Roles('ADMIN','BIBLIOTHECAIRE','RESPONSABLE_BIBLIOTHEQUE')` · perms : aucune | **aucun** | MINIMAL |
| **SupportItModule** | `src/support-it/support-it.module.ts` | — (agrégateur) | — | — | — | — | — | COMPLET |
| ├ **RequeteModule** | `src/support-it/requetes/requete.module.ts` | `requete.controller.ts` | `requete.service.ts` | `create-requete`, `list-requete-query`, `requete.response`, paginé | `requete`, `personnel` | **aucun `@Roles` de classe** ; seul `PATCH :id/cloturer` restreint · périmètre filtré dans le service · perms : aucune | U ×1 · I ×1 | COMPLET |
| ├ **InterventionModule** | `src/support-it/interventions/intervention.module.ts` | `intervention.controller.ts` | `intervention.service.ts` | `create-intervention`, `list-intervention-query`, `intervention.response`, paginé | `intervention`, `requete`, `technicien` | pas de `@Roles` de classe ; POST `@Roles('TECHNICIEN')` · perms : aucune | U ×1 · I ×1 | COMPLET |
| ├ **CoursSupportITModule** | `src/support-it/cours/cours.module.ts` | `cours.controller.ts` | `cours.service.ts` | `create-cours`, `list-cours-query`, `cours.response`, paginé | `coursSupportIT` | pas de `@Roles` de classe ; POST `@Roles('RESPONSABLE_IT','ADMIN')` · perms : aucune | U ×1 · I ×1 | COMPLET |
| ├ **InscriptionCoursSupportITModule** | `src/support-it/inscriptions/inscription.module.ts` | `inscription.controller.ts`, `inscription-enrollment.controller.ts` | `inscription.service.ts` | `list-inscription-query`, `create-evaluation`, `inscription.response`, paginé, `evaluation.response` | `inscriptionCoursSupportIT`, `coursSupportIT`, `evaluationSupportIT` | pas de `@Roles` de classe ; `POST :id/evaluation` restreint · perms : aucune | U ×1 · I ×1 | COMPLET |
| ├ **AttestationModule** | `src/support-it/attestations/attestation.module.ts` | **aucun** | `attestation.service.ts` | `attestation.types.ts` (pas un DTO HTTP) | **aucun accès Prisma** | non exposé en HTTP | U ×1 | MINIMAL (stub documenté comme provisoire dans le code) |
| ├ **PosteModule** | `src/support-it/postes/poste.module.ts` | `poste.controller.ts` | `poste.service.ts` | `create-poste`, `list-poste-query`, `update-poste-statut`, `poste.response`, paginé, `disponibilite-poste` | `poste` | pas de `@Roles` de classe ; POST + PATCH restreints · perms : aucune | U ×1 · I ×1 | COMPLET |
| └ **StatsModule (support-it)** | `src/support-it/stats/stats.module.ts` | `stats.controller.ts` | `stats.service.ts` | `list-synthese-query`, `synthese-mensuelle.response` | `requete` | classe `@Roles('RESPONSABLE_IT','ADMIN')` · perms : aucune | U ×1 · I ×1 | COMPLET |
| **MessageModule** | `src/messagerie/message.module.ts` | `message.controller.ts` | `message.service.ts` | `create-message`, `list-message-query`, `message.response`, paginé | `messageInterne`, `utilisateur` | **aucun `@Roles`** — tout compte authentifié ; périmètre appliqué dans le service · perms : aucune | U ×1 · I ×1 | COMPLET |

---

## C. Couplages inter-modules

Uniquement les dépendances **réellement observées dans le code**.

| Source | Dépend de | Type | Justification / risque |
|---|---|---|---|
| `AppModule` | `AuthModule` | import + `APP_GUARD` | Les 3 guards globaux sont définis dans `src/auth/guards/` et enregistrés dans `app.module.ts` |
| `AppModule` | `PrismaModule` | import global | `PrismaService` injectable partout sans réimport |
| `EmpruntModule` | `RegularityService` | **import NestJS + injection de service** | Vérification de la régularité étudiante avant emprunt. Implémente le contrat « Scolarité ↔ Bibliothèque » de CLAUDE.md **en injection directe**, pas en appel HTTP. ⚠️ Modifier la signature de `RegularityService` casse Bibliothèque. |
| `EmpruntModule` | `ConfigModule` | import | Lecture de `bibliotheque.empruntDomicileTypesAutorises` |
| `InscriptionCoursSupportITModule` | `AttestationModule` | import + injection | `InscriptionService` appelle `AttestationService.genererAttestationSupportIT()` quand `statutReussite = true` |
| `RegistrationWorkflowService` | modèle Prisma `abonne` | **accès Prisma partagé (couplage par la base)** | Le workflow d'inscription écrit dans `abonne`, modèle appartenant au domaine Bibliothèque. ⚠️ Deux domaines écrivent la même table → conflit possible si deux agents travaillent en parallèle sur Scolarité et Bibliothèque. Couplage **non documenté** dans CLAUDE.md. |
| 9 modules | `common/dto/pagination.dto.ts` | DTO partagé | ⚠️ Toute modification de ce fichier impacte simultanément 9 modules — point de contention majeur pour BACK-02. |
| Tous les modules métier | `common/decorators/*` | décorateurs | `@Roles`, `@CurrentUser`, `@Public`, `@Permissions` |
| Tous les modules métier | `auth/interfaces/auth.interfaces` | type | Typage de `AuthenticatedUser` pour `@CurrentUser()` |

---

## D. Inventaire complet des 88 endpoints

Routes réelles = `/api/v1` + préfixe controller + chemin méthode (versioning URI, `defaultVersion: '1'`).
« Rôles » = valeur **effective** après application de la règle d'écrasement (voir note en fin de section).
Colonne « Perms » : `NONE` partout — voir §H / CONTRA-04.

### Auth — `src/auth/auth.controller.ts` (4)

| Méthode | Route | Handler | DTO entrée | Réponse | Auth | Rôles | Erreurs | Tests |
|---|---|---|---|---|---|---|---|---|
| POST | `/api/v1/auth/login` | `login` | `LoginDto` | `AccessTokenResponseDto` + cookie | **PUBLIC** | NONE | 400, 401, 429 | I ✓ |
| POST | `/api/v1/auth/refresh` | `refresh` | NONE (cookie) | `AccessTokenResponseDto` + cookie | **PUBLIC** | NONE | 401, 429 | I ✓ |
| GET | `/api/v1/auth/me` | `me` | NONE | `UserProfileResponseDto` | AUTHENTICATED | NONE | 401 | I ✓ |
| POST | `/api/v1/auth/logout` | `logout` | NONE | `void` (204) | AUTHENTICATED | NONE | 401 | I ✓ |

### Identity / Users — `src/identity/users/users.controller.ts` (8)

| Méthode | Route | Handler | DTO entrée | Réponse | Auth | Rôles | Erreurs | Tests |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/utilisateurs` | `findAll` | `QueryUserDto` | `PaginatedUsersResponseDto` | AUTHENTICATED | ADMIN, SCOLARITE | 200 | **aucun** |
| POST | `/api/v1/utilisateurs` | `create` | `CreateUserDto` | `UserResponseDto` | AUTHENTICATED | ADMIN | 201, 409 | **aucun** |
| GET | `/api/v1/utilisateurs/:id` | `findOne` | NONE | `UserResponseDto` | AUTHENTICATED | ADMIN, SCOLARITE | 200, 404 | **aucun** |
| PATCH | `/api/v1/utilisateurs/:id` | `update` | `UpdateUserDto` | `UserResponseDto` | AUTHENTICATED | ADMIN | 200, 409 | **aucun** |
| DELETE | `/api/v1/utilisateurs/:id` | `remove` | NONE | `void` (204) | AUTHENTICATED | ADMIN | 204 | **aucun** |
| PATCH | `/api/v1/utilisateurs/:id/password` | `changePassword` | `ChangePasswordDto` | `void` (204) | AUTHENTICATED | ADMIN | 204 | **aucun** |
| POST | `/api/v1/utilisateurs/:id/roles/:roleId` | `assignRole` | NONE | `UserResponseDto` | AUTHENTICATED | ADMIN | 200, 404 | **aucun** |
| DELETE | `/api/v1/utilisateurs/:id/roles/:roleId` | `removeRole` | NONE | `UserResponseDto` | AUTHENTICATED | ADMIN | 200, 404 | **aucun** |

### Identity / Roles — `src/identity/roles/roles.controller.ts` (7)

| Méthode | Route | Handler | DTO entrée | Réponse | Auth | Rôles | Erreurs | Tests |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/roles` | `findAll` | **NONE** | `RoleResponseDto[]` | AUTHENTICATED | ADMIN | 200 | **aucun** |
| POST | `/api/v1/roles` | `create` | `CreateRoleDto` | `RoleResponseDto` | AUTHENTICATED | ADMIN | 201, 409 | **aucun** |
| GET | `/api/v1/roles/:id` | `findOne` | NONE | `RoleResponseDto` | AUTHENTICATED | ADMIN | 200, 404 | **aucun** |
| PATCH | `/api/v1/roles/:id` | `update` | `UpdateRoleDto` | `RoleResponseDto` | AUTHENTICATED | ADMIN | 200 | **aucun** |
| DELETE | `/api/v1/roles/:id` | `remove` | NONE | `void` (204) | AUTHENTICATED | ADMIN | 204, 409 | **aucun** |
| POST | `/api/v1/roles/:id/permissions/:permissionId` | `assignPermission` | NONE | `RoleResponseDto` | AUTHENTICATED | ADMIN | 200 | **aucun** |
| DELETE | `/api/v1/roles/:id/permissions/:permissionId` | `removePermission` | NONE | `RoleResponseDto` | AUTHENTICATED | ADMIN | 200 | **aucun** |

### Identity / Permissions — `src/identity/permissions/permissions.controller.ts` (5)

| Méthode | Route | Handler | DTO entrée | Réponse | Auth | Rôles | Erreurs | Tests |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/permissions` | `findAll` | **NONE** | `PermissionResponseDto[]` | AUTHENTICATED | ADMIN | 200 | **aucun** |
| POST | `/api/v1/permissions` | `create` | `CreatePermissionDto` | `PermissionResponseDto` | AUTHENTICATED | ADMIN | 201, 409 | **aucun** |
| GET | `/api/v1/permissions/:id` | `findOne` | NONE | `PermissionResponseDto` | AUTHENTICATED | ADMIN | 200, 404 | **aucun** |
| PATCH | `/api/v1/permissions/:id` | `update` | `UpdatePermissionDto` | `PermissionResponseDto` | AUTHENTICATED | ADMIN | 200 | **aucun** |
| DELETE | `/api/v1/permissions/:id` | `remove` | NONE | `void` (204) | AUTHENTICATED | ADMIN | 204, 409 | **aucun** |

### Scolarité / Registration — `src/scolarite/registration/registration.controller.ts` (6)

| Méthode | Route | Handler | DTO entrée | Réponse | Auth | Rôles | Erreurs | Tests |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/dossiers-inscription` | `findAll` | `QueryDossierInscriptionDto` | `PaginatedDossiersInscriptionResponseDto` | AUTHENTICATED | SCOLARITE, ADMIN | 200, 400, 401, 403 | U+I ✓ |
| GET | `/api/v1/dossiers-inscription/stats` | `stats` | NONE | `DossierInscriptionStatsResponseDto` | AUTHENTICATED | SCOLARITE, ADMIN | 200, 401, 403 | U+I ✓ |
| POST | `/api/v1/dossiers-inscription/:id/submit` | `submit` | `TransitionDto` | `TransitionResult` (200) | AUTHENTICATED | SCOLARITE, ADMIN | 400, 404, 409, 422 | U+I ✓ |
| POST | `/api/v1/dossiers-inscription/:id/start-processing` | `startProcessing` | `TransitionDto` | `TransitionResult` (200) | AUTHENTICATED | SCOLARITE, ADMIN | 400, 404, 409, 422 | U+I ✓ |
| POST | `/api/v1/dossiers-inscription/:id/register` | `register` | `TransitionDto` | `TransitionResult` (200) | AUTHENTICATED | SCOLARITE, ADMIN | 400, 404, 409, 422 | U+I ✓ |
| POST | `/api/v1/dossiers-inscription/:id/reject` | `reject` | `RejectDossierDto` | `TransitionResult` (200) | AUTHENTICATED | SCOLARITE, ADMIN | 400, 404, 409, 422 | U+I ✓ |

### Scolarité / Régularité — `src/scolarite/regularity/regularity.controller.ts` (1)

| Méthode | Route | Handler | DTO entrée | Réponse | Auth | Rôles | Erreurs | Tests |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/etudiants/:matricule/statut-regularite` | `getRegularityStatus` | NONE (param non-UUID, pas de `ParseUUIDPipe`) | `RegularityStatusResponseDto` | AUTHENTICATED | ADMIN, SCOLARITE, BIBLIOTHECAIRE | 200, 404 | U+I ✓ |

### Scolarité / Abandon — `src/scolarite/abandon/abandon.controller.ts` (5)

| Méthode | Route | Handler | DTO entrée | Réponse | Auth | Rôles | Erreurs | Tests |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/abandons` | `findAll` | `QueryAbandonDto` | `AbandonListResponseDto` | AUTHENTICATED | SCOLARITE, ADMIN | 200, 400, 401, 403 | U+I ✓ |
| POST | `/api/v1/abandons` | `signaler` | `SignalerAbandonDto` | `AbandonResponseDto` (201) | AUTHENTICATED | SCOLARITE, ADMIN | 201, 404, 409 | U+I ✓ |
| GET | `/api/v1/abandons/:id` | `findOne` | NONE | `AbandonResponseDto` | AUTHENTICATED | SCOLARITE, ADMIN | 200, 404 | U+I ✓ |
| POST | `/api/v1/abandons/:id/demander-reprise` | `demanderReprise` | NONE | `AbandonResponseDto` (200) | AUTHENTICATED | SCOLARITE, ADMIN | 200, 404, 409, 422 | U+I ✓ |
| POST | `/api/v1/abandons/:id/decider-reprise` | `deciderReprise` | `DeciderRepriseDto` | `AbandonResponseDto` (200) | AUTHENTICATED | SCOLARITE, ADMIN | 200, 404, 409, 422 | U+I ✓ |

### Pédagogie / CoursClasse — `src/pedagogie/cours-classe/cours-classe.controller.ts` (4)

| Méthode | Route | Handler | DTO entrée | Réponse | Auth | Rôles | Erreurs | Tests |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/cours-classes` | `findAll` | `ListCoursClasseQueryDto` | `CoursClasseResponseDto[]` | AUTHENTICATED | ADMIN, DGA_ETUDES, CHEF_DEPARTEMENT, ENSEIGNANT | 200 | U+I ✓ |
| POST | `/api/v1/cours-classes` | `create` | `CreateCoursClasseDto` | `CoursClasseResponseDto` | AUTHENTICATED | ADMIN, DGA_ETUDES | 201, 404, 409 | U+I ✓ |
| GET | `/api/v1/cours-classes/:id` | `findOne` | NONE | `CoursClasseResponseDto` | AUTHENTICATED | ADMIN, DGA_ETUDES, CHEF_DEPARTEMENT, ENSEIGNANT | 200, 404 | U+I ✓ |
| DELETE | `/api/v1/cours-classes/:id` | `remove` | NONE | `void` (204) | AUTHENTICATED | **ADMIN** (hérité de la classe) | 204, 404, 409 | U+I ✓ |

### Pédagogie / Épreuves — `src/pedagogie/epreuve/epreuve.controller.ts` (4)

| Méthode | Route | Handler | DTO entrée | Réponse | Auth | Rôles | Erreurs | Tests |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/epreuves` | `findAll` | `ListEpreuveQueryDto` | `EpreuveResponseDto[]` | AUTHENTICATED | ADMIN, DGA_ETUDES, CHEF_DEPARTEMENT, ENSEIGNANT | 200 | U+I ✓ |
| POST | `/api/v1/epreuves` | `create` | `CreateEpreuveDto` | `EpreuveResponseDto` | AUTHENTICATED | ADMIN, DGA_ETUDES, ENSEIGNANT | 201, 404, 409 | U+I ✓ |
| GET | `/api/v1/epreuves/:id` | `findOne` | NONE | `EpreuveResponseDto` | AUTHENTICATED | ADMIN, DGA_ETUDES, CHEF_DEPARTEMENT, ENSEIGNANT | 200, 404 | U+I ✓ |
| DELETE | `/api/v1/epreuves/:id` | `remove` | NONE | `void` (204) | AUTHENTICATED | **ADMIN** (hérité) | 204, 404, 409 | U+I ✓ |

### Pédagogie / Notes — `src/pedagogie/note-etudiant/note-etudiant.controller.ts` (5)

| Méthode | Route | Handler | DTO entrée | Réponse | Auth | Rôles | Erreurs | Tests |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/notes-etudiant` | `findAll` | `ListNoteEtudiantQueryDto` | `NoteEtudiantResponseDto[]` | AUTHENTICATED | ADMIN, DGA_ETUDES, CHEF_DEPARTEMENT, ENSEIGNANT | 200 | U+I ✓ |
| POST | `/api/v1/notes-etudiant` | `create` | `CreateNoteEtudiantDto` | `NoteEtudiantResponseDto` | AUTHENTICATED | ADMIN, DGA_ETUDES, ENSEIGNANT | 201, 403, 404, 409 | U+I ✓ |
| GET | `/api/v1/notes-etudiant/:id` | `findOne` | NONE | `NoteEtudiantResponseDto` | AUTHENTICATED | ADMIN, DGA_ETUDES, CHEF_DEPARTEMENT, ENSEIGNANT | 200, 404 | U+I ✓ |
| PATCH | `/api/v1/notes-etudiant/:id` | `update` | `UpdateNoteEtudiantDto` | `NoteEtudiantResponseDto` | AUTHENTICATED | ADMIN, DGA_ETUDES, ENSEIGNANT | 200, 403, 404 | U+I ✓ |
| DELETE | `/api/v1/notes-etudiant/:id` | `remove` | NONE | `void` (204) | AUTHENTICATED | **ADMIN** (hérité) | 204, 404, 409 | U+I ✓ |

### Bibliothèque / Ouvrages — `src/bibliotheque/ouvrages/ouvrage.controller.ts` (5)

| Méthode | Route | Handler | DTO entrée | Réponse | Auth | Rôles | Erreurs | Tests |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/ouvrages` | `findAll` | `ListOuvrageQueryDto` | `OuvrageResponseDto[]` | AUTHENTICATED | ADMIN, BIBLIOTHECAIRE, RESPONSABLE_BIBLIOTHEQUE, ETUDIANT, ENSEIGNANT | 200 | U ✓ |
| POST | `/api/v1/ouvrages` | `create` | `CreateOuvrageDto` | `OuvrageResponseDto` | AUTHENTICATED | ADMIN, BIBLIOTHECAIRE, RESPONSABLE_BIBLIOTHEQUE | 201, 404 | U ✓ |
| GET | `/api/v1/ouvrages/:id` | `findOne` | NONE | `OuvrageResponseDto` | AUTHENTICATED | (5 rôles hérités) | 200, 404 | U ✓ |
| PATCH | `/api/v1/ouvrages/:id` | `update` | `UpdateOuvrageDto` | `OuvrageResponseDto` | AUTHENTICATED | ADMIN, BIBLIOTHECAIRE, RESPONSABLE_BIBLIOTHEQUE | 200, 404 | U ✓ |
| DELETE | `/api/v1/ouvrages/:id` | `remove` | NONE | `void` (204) | AUTHENTICATED | ADMIN, BIBLIOTHECAIRE, RESPONSABLE_BIBLIOTHEQUE | 204, 404, 409 | U ✓ |

### Bibliothèque / Abonnés — `src/bibliotheque/abonnes/abonne.controller.ts` (2)

| Méthode | Route | Handler | DTO entrée | Réponse | Auth | Rôles | Erreurs | Tests |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/abonnes` | `findAll` | **NONE** | `AbonneResponseDto[]` | AUTHENTICATED | ADMIN, BIBLIOTHECAIRE, RESPONSABLE_BIBLIOTHEQUE | 200 | U ✓ |
| POST | `/api/v1/abonnes` | `create` | `CreateAbonneDto` | `AbonneResponseDto` | AUTHENTICATED | idem | 201, 404, 409 | U ✓ |

### Bibliothèque / Emprunts — `src/bibliotheque/emprunts/emprunt.controller.ts` (3)

| Méthode | Route | Handler | DTO entrée | Réponse | Auth | Rôles | Erreurs | Tests |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/emprunts` | `findAll` | `ListEmpruntQueryDto` | `EmpruntResponseDto[]` | AUTHENTICATED | ADMIN, BIBLIOTHECAIRE, RESPONSABLE_BIBLIOTHEQUE, ETUDIANT, ENSEIGNANT | 200 | U+I ✓ |
| POST | `/api/v1/emprunts` | `create` | `CreateEmpruntDto` | `EmpruntResponseDto` | AUTHENTICATED | ADMIN, BIBLIOTHECAIRE, RESPONSABLE_BIBLIOTHEQUE | 201, 403, 404, 409 | U+I ✓ |
| PATCH | `/api/v1/emprunts/:id/retour` | `retour` | NONE | `EmpruntResponseDto` | AUTHENTICATED | ADMIN, BIBLIOTHECAIRE, RESPONSABLE_BIBLIOTHEQUE | 200, 404, 409 | U+I ✓ |

### Bibliothèque / Réservations — `src/bibliotheque/reservations/reservation.controller.ts` (1)

| Méthode | Route | Handler | DTO entrée | Réponse | Auth | Rôles | Erreurs | Tests |
|---|---|---|---|---|---|---|---|---|
| POST | `/api/v1/reservations` | `create` | `CreateReservationDto` | `ReservationResponseDto` | AUTHENTICATED | ETUDIANT, ENSEIGNANT | 201, 404, 409 | U ✓ |

### Bibliothèque / Documents académiques — `src/bibliotheque/documents-academiques/document-academique.controller.ts` (4)

| Méthode | Route | Handler | DTO entrée | Réponse | Auth | Rôles | Erreurs | Tests |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/documents-academiques` | `findAll` | `ListDocumentAcademiqueQueryDto` | `DocumentAcademiqueResponseDto[]` | AUTHENTICATED | ADMIN, RESPONSABLE_NUMERISATION, ETUDIANT, ENSEIGNANT | 200 | U ✓ |
| POST | `/api/v1/documents-academiques` | `create` | `CreateDocumentAcademiqueDto` | `DocumentAcademiqueResponseDto` | AUTHENTICATED | ADMIN, RESPONSABLE_NUMERISATION | 201, 404 | U ✓ |
| GET | `/api/v1/documents-academiques/:id` | `findOne` | NONE | `DocumentAcademiqueResponseDto` | AUTHENTICATED | (4 rôles hérités) | 200, 404 | U ✓ |
| PATCH | `/api/v1/documents-academiques/:id` | `update` | `UpdateDocumentAcademiqueDto` | `DocumentAcademiqueResponseDto` | AUTHENTICATED | ADMIN, RESPONSABLE_NUMERISATION | 200, 404 | U ✓ |

### Bibliothèque / Stats — `src/bibliotheque/stats/stats.controller.ts` (1)

| Méthode | Route | Handler | DTO entrée | Réponse | Auth | Rôles | Erreurs | Tests |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/bibliotheque/stats/dashboard` | `dashboard` | NONE | `BibliothequeStatsResponseDto` | AUTHENTICATED | ADMIN, BIBLIOTHECAIRE, RESPONSABLE_BIBLIOTHEQUE | 200 | **aucun** |

### Support IT / Requêtes — `src/support-it/requetes/requete.controller.ts` (4)

| Méthode | Route | Handler | DTO entrée | Réponse | Auth | Rôles | Erreurs | Tests |
|---|---|---|---|---|---|---|---|---|
| POST | `/api/v1/requetes` | `create` | `CreateRequeteDto` | `RequeteResponseDto` | AUTHENTICATED | **NONE** (403 dans le service si pas de profil Personnel) | 201, 403 | U+I ✓ |
| GET | `/api/v1/requetes` | `findAll` | `ListRequeteQueryDto` | `PaginatedRequeteResponseDto` | AUTHENTICATED | **NONE** (périmètre filtré dans le service) | 200 | U+I ✓ |
| GET | `/api/v1/requetes/:id` | `findOne` | NONE | `RequeteResponseDto` | AUTHENTICATED | **NONE** (403 dans le service si hors périmètre) | 200, 403, 404 | U+I ✓ |
| PATCH | `/api/v1/requetes/:id/cloturer` | `cloturer` | NONE | `RequeteResponseDto` | AUTHENTICATED | TECHNICIEN, RESPONSABLE_IT, ADMIN | 200, 403, 404, 409 | U+I ✓ |

### Support IT / Interventions — `src/support-it/interventions/intervention.controller.ts` (2)

| Méthode | Route | Handler | DTO entrée | Réponse | Auth | Rôles | Erreurs | Tests |
|---|---|---|---|---|---|---|---|---|
| POST | `/api/v1/requetes/:requeteId/interventions` | `create` | `CreateInterventionDto` | `InterventionResponseDto` | AUTHENTICATED | TECHNICIEN | 201, 403, 404, 409 | U+I ✓ |
| GET | `/api/v1/requetes/:requeteId/interventions` | `findAllForRequete` | `ListInterventionQueryDto` | `PaginatedInterventionResponseDto` | AUTHENTICATED | **NONE** | 200, 403, 404 | U+I ✓ |

### Support IT / Cours — `src/support-it/cours/cours.controller.ts` (3)

| Méthode | Route | Handler | DTO entrée | Réponse | Auth | Rôles | Erreurs | Tests |
|---|---|---|---|---|---|---|---|---|
| POST | `/api/v1/cours-support-it` | `create` | `CreateCoursSupportITDto` | `CoursSupportITResponseDto` | AUTHENTICATED | RESPONSABLE_IT, ADMIN | 201 | U+I ✓ |
| GET | `/api/v1/cours-support-it` | `findAll` | `ListCoursSupportITQueryDto` | `PaginatedCoursSupportITResponseDto` | AUTHENTICATED | **NONE** | 200 | U+I ✓ |
| GET | `/api/v1/cours-support-it/:id` | `findOne` | NONE | `CoursSupportITResponseDto` | AUTHENTICATED | **NONE** | 200, 404 | U+I ✓ |

### Support IT / Inscriptions — `inscription.controller.ts` + `inscription-enrollment.controller.ts` (4)

| Méthode | Route | Handler | DTO entrée | Réponse | Auth | Rôles | Erreurs | Tests |
|---|---|---|---|---|---|---|---|---|
| POST | `/api/v1/cours-support-it/:coursId/inscriptions` | `enroll` | NONE | `InscriptionCoursSupportITResponseDto` | AUTHENTICATED | **NONE** (auto-inscription) | 201, 404, 409 | U+I ✓ |
| GET | `/api/v1/inscriptions-support-it` | `findAll` | `ListInscriptionQueryDto` | `PaginatedInscriptionCoursSupportITResponseDto` | AUTHENTICATED | **NONE** (périmètre dans le service) | 200 | U+I ✓ |
| GET | `/api/v1/inscriptions-support-it/:id` | `findOne` | NONE | `InscriptionCoursSupportITResponseDto` | AUTHENTICATED | **NONE** | 200, 403, 404 | U+I ✓ |
| POST | `/api/v1/inscriptions-support-it/:id/evaluation` | `evaluer` | `CreateEvaluationSupportITDto` | `EvaluationSupportITResponseDto` | AUTHENTICATED | RESPONSABLE_IT, ADMIN | 201, 404, 409 | U+I ✓ |

### Support IT / Postes — `src/support-it/postes/poste.controller.ts` (5)

| Méthode | Route | Handler | DTO entrée | Réponse | Auth | Rôles | Erreurs | Tests |
|---|---|---|---|---|---|---|---|---|
| POST | `/api/v1/postes` | `create` | `CreatePosteDto` | `PosteResponseDto` | AUTHENTICATED | RESPONSABLE_IT, ADMIN | 201 | U+I ✓ |
| GET | `/api/v1/postes` | `findAll` | `ListPosteQueryDto` | `PaginatedPosteResponseDto` | AUTHENTICATED | **NONE** | 200 | U+I ✓ |
| GET | `/api/v1/postes/stats/disponibilite` | `disponibiliteParSalle` | NONE | `DisponibilitePosteDto[]` | AUTHENTICATED | **NONE** | 200 | U+I ✓ |
| GET | `/api/v1/postes/:id` | `findOne` | NONE | `PosteResponseDto` | AUTHENTICATED | **NONE** | 200, 404 | U+I ✓ |
| PATCH | `/api/v1/postes/:id/statut` | `updateStatut` | `UpdatePosteStatutDto` | `PosteResponseDto` | AUTHENTICATED | RESPONSABLE_IT, ADMIN, TECHNICIEN | 200, 404 | U+I ✓ |

### Support IT / Stats — `src/support-it/stats/stats.controller.ts` (1)

| Méthode | Route | Handler | DTO entrée | Réponse | Auth | Rôles | Erreurs | Tests |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/support-it/stats/synthese-mensuelle` | `syntheseMensuelle` | `ListSyntheseQueryDto` | `SyntheseMensuelleResponseDto` | AUTHENTICATED | RESPONSABLE_IT, ADMIN | 200 | U+I ✓ |

### Messagerie — `src/messagerie/message.controller.ts` (4)

| Méthode | Route | Handler | DTO entrée | Réponse | Auth | Rôles | Erreurs | Tests |
|---|---|---|---|---|---|---|---|---|
| POST | `/api/v1/messages` | `create` | `CreateMessageDto` | `MessageResponseDto` | AUTHENTICATED | **NONE** | 201, 404 | U+I ✓ |
| GET | `/api/v1/messages/recus` | `findRecus` | `ListMessageQueryDto` | `PaginatedMessageResponseDto` | AUTHENTICATED | **NONE** | 200 | U+I ✓ |
| GET | `/api/v1/messages/envoyes` | `findEnvoyes` | `ListMessageQueryDto` | `PaginatedMessageResponseDto` | AUTHENTICATED | **NONE** | 200 | U+I ✓ |
| GET | `/api/v1/messages/:id` | `findOne` | NONE | `MessageResponseDto` | AUTHENTICATED | **NONE** | 200, 403, 404 | U+I ✓ |

> **Note sur la résolution des rôles** — `RolesGuard` utilise `reflector.getAllAndOverride(ROLES_KEY, [handler, class])` : le `@Roles` de **méthode écrase** celui de classe, il n'y a **pas de fusion**. Conséquence directe : `DELETE /cours-classes/:id`, `DELETE /epreuves/:id` et `DELETE /notes-etudiant/:id` sont **ADMIN seul** par héritage de classe. Logique **OR** entre rôles listés ; `PermissionsGuard` utilise la même résolution mais une logique **AND** entre permissions.

---

## E. Pagination

### E.1 — Endpoints déjà paginés (10)

`PaginationDto` (`common/dto/pagination.dto.ts`) : défauts `page=1`, `limit=20`, `limit` plafonné à 100. Réponse au format `{ data, meta }` où `meta` = `PaginationMetaDto` (`total`, `page`, `limit`, `totalPages`).

| Endpoint | DTO query | Étend `PaginationDto` | page/limit | Format réponse | Consommateur frontend |
|---|---|---|---|---|---|
| `GET /api/v1/utilisateurs` | `QueryUserDto` | ✅ | oui | `PaginatedUsersResponseDto` | `IdentityManagement.tsx` (via fetch manuel `page`/`limit`) |
| `GET /api/v1/dossiers-inscription` | `QueryDossierInscriptionDto` | ✅ | oui | `PaginatedDossiersInscriptionResponseDto` | aucun |
| `GET /api/v1/abandons` | `QueryAbandonDto` | ✅ | oui | `AbandonListResponseDto` | aucun |
| `GET /api/v1/messages/recus` | `ListMessageQueryDto` | ✅ | oui | `PaginatedMessageResponseDto` | `/it` messagerie (`usePaginatedFetch`) |
| `GET /api/v1/messages/envoyes` | `ListMessageQueryDto` (même DTO) | ✅ | oui | `PaginatedMessageResponseDto` | `/it` messagerie |
| `GET /api/v1/requetes` | `ListRequeteQueryDto` | ✅ | oui | `PaginatedRequeteResponseDto` | `/it/requetes` (`usePaginatedFetch`) |
| `GET /api/v1/requetes/:requeteId/interventions` | `ListInterventionQueryDto` | ✅ | oui | `PaginatedInterventionResponseDto` | `/it/requetes/[id]` (`usePaginatedFetch`) |
| `GET /api/v1/cours-support-it` | `ListCoursSupportITQueryDto` | ✅ | oui | `PaginatedCoursSupportITResponseDto` | `/it/cours` |
| `GET /api/v1/inscriptions-support-it` | `ListInscriptionQueryDto` | ✅ | oui | `PaginatedInscriptionCoursSupportITResponseDto` | `/it/inscriptions` |
| `GET /api/v1/postes` | `ListPosteQueryDto` | ✅ | oui | `PaginatedPosteResponseDto` | `/it/postes` |

> **9 DTOs pour 10 endpoints** : `ListMessageQueryDto` sert à la fois `/messages/recus` et `/messages/envoyes`. C'est ce qui réconcilie les deux chiffres.

### E.2 — Endpoints de collection non paginés (9)

| Endpoint | DTO query | Cause | Réponse actuelle |
|---|---|---|---|
| `GET /api/v1/notes-etudiant` | `ListNoteEtudiantQueryDto` | DTO existe, n'étend pas `PaginationDto` | `NoteEtudiantResponseDto[]` |
| `GET /api/v1/ouvrages` | `ListOuvrageQueryDto` | idem | `OuvrageResponseDto[]` |
| `GET /api/v1/cours-classes` | `ListCoursClasseQueryDto` | idem | `CoursClasseResponseDto[]` |
| `GET /api/v1/epreuves` | `ListEpreuveQueryDto` | idem | `EpreuveResponseDto[]` |
| `GET /api/v1/emprunts` | `ListEmpruntQueryDto` | idem | `EmpruntResponseDto[]` |
| `GET /api/v1/documents-academiques` | `ListDocumentAcademiqueQueryDto` | idem | `DocumentAcademiqueResponseDto[]` |
| `GET /api/v1/roles` | **aucun DTO** | pas de DTO de query du tout | `RoleResponseDto[]` |
| `GET /api/v1/permissions` | **aucun DTO** | idem | `PermissionResponseDto[]` |
| `GET /api/v1/abonnes` | **aucun DTO** | idem | `AbonneResponseDto[]` |

> Les 3 derniers étaient **invisibles à une recherche par DTO** — c'est la raison pour laquelle la Phase 0 avait annoncé « 7 DTOs » (dont un agrégat) au lieu de 9 endpoints.

### E.3 — Hors périmètre (agrégats, non paginables)

`GET /support-it/stats/synthese-mensuelle` (objet unique) · `GET /bibliotheque/stats/dashboard` (objet unique) · `GET /dossiers-inscription/stats` (objet unique) · `GET /postes/stats/disponibilite` (agrégat borné par salle).

---

## F. Consommateurs frontend

### F.1 — Endpoints non paginés AVEC consommateur frontend (4) — évolution contractuelle bloquante

Ces 4 endpoints renvoient aujourd'hui un **tableau nu**, que le frontend consomme directement (`apiFetch<T[]>` puis `.map()`/`.length`). Les paginer transformerait la réponse en `{ data, meta }` : le frontend recevrait un objet là où il attend un tableau, `.map()` lèverait une `TypeError` à l'exécution. **Le typage TypeScript ne protégerait pas** — `apiFetch<T>` fait un simple cast du JSON, sans validation à l'exécution : la casse serait silencieuse à la compilation et visible seulement en production.

| Endpoint | Fichier consommateur | Ligne | Appel actuel |
|---|---|---|---|
| `GET /cours-classes` | `apps/web/src/app/enseignant/page.tsx` | 49 | `apiFetch<CoursClasse[]>("/cours-classes")` |
| `GET /notes-etudiant` | `apps/web/src/app/enseignant/page.tsx` | 59 | `apiFetch<NoteEtudiant[]>("/notes-etudiant")` |
| `GET /roles` | `apps/web/src/app/admin/_components/IdentityManagement.tsx` | 86 | `apiFetch<RoleItem[]>("/roles")` |
| `GET /permissions` | `apps/web/src/app/admin/_components/IdentityManagement.tsx` | 96 | `apiFetch<PermissionItem[]>("/permissions")` |

⚠️ `GET /roles` alimente aussi le panneau « Gérer les rôles » du tableau Utilisateurs (`/admin/parametres`) — une casse ici touche la gestion des droits, pas seulement un affichage.

Point d'appui existant : le hook `apps/web/src/lib/usePaginatedFetch.ts` attend déjà le format `{ data, meta }` et est utilisé sur 8 appels vers des endpoints déjà paginés. C'est la cible naturelle de migration, mais elle implique une modification frontend.

### F.2 — Endpoints non paginés SANS consommateur frontend (5) — migration backend pure

`GET /ouvrages` · `GET /emprunts` · `GET /documents-academiques` · `GET /epreuves` · `GET /abonnes`

Aucune référence trouvée dans `apps/web`. Ces 5 endpoints peuvent être paginés sans coordination frontend.

---

## G. AuditLog

**Rôle** : table de traçabilité des événements. Modèle Prisma `AuditLog`, enum `AuditAction`.

**Emplacements réels de `auditLog.create`** — **3 appels, tous dans `apps/api/src/auth/auth.service.ts`** (lignes ~363, ~438, ~566).

**Événements actuellement couverts** : connexion réussie, échec de connexion (compte inexistant / désactivé / verrouillé / mot de passe invalide), verrouillage de compte, rafraîchissement de token, déconnexion.

**Historiques métier dédiés existants** (nuance importante — ces domaines ne sont **pas** des trous de traçabilité) :
- `registrationHistory` — alimenté par `registration-workflow.service.ts` (+ `outboxEvent`)
- `noteEtudiantHistory` — alimenté par `note-etudiant.service.ts`

**Périmètre du trou réel : 17 services / 45 mutations sans aucune traçabilité.**

| Service | Mutations Prisma | Traçabilité |
|---|---|---|
| `users.service.ts` | 6 | **aucune** |
| `roles.service.ts` | 5 | **aucune** |
| `abandon.service.ts` | 5 | **aucune** |
| `emprunt.service.ts` | 4 | **aucune** |
| `permissions.service.ts` | 3 | **aucune** |
| `ouvrage.service.ts` | 3 | **aucune** |
| `inscription.service.ts` (support-it) | 3 | **aucune** |
| `cours-classe.service.ts` | 2 | **aucune** |
| `epreuve.service.ts` | 2 | **aucune** |
| `document-academique.service.ts` | 2 | **aucune** |
| `intervention.service.ts` | 2 | **aucune** |
| `poste.service.ts` | 2 | **aucune** |
| `requete.service.ts` | 2 | **aucune** |
| `abonne.service.ts` | 1 | **aucune** |
| `reservation.service.ts` | 1 | **aucune** |
| `message.service.ts` | 1 | **aucune** |
| `cours.service.ts` (support-it) | 1 | **aucune** |
| — *(hors périmètre du trou)* | | |
| `registration-workflow.service.ts` | 5 | ✅ `registrationHistory` + `outboxEvent` |
| `note-etudiant.service.ts` | 4 | ✅ `noteEtudiantHistory` |

Les plus sensibles du trou : `users`, `roles`, `permissions` — soit toute la gestion des comptes et des droits, sans aucune trace.

---

## H. Permissions — couche dormante

Constat factuel, sans proposition de correction :

- `PermissionsGuard` (`src/auth/guards/permissions.guard.ts`) **existe** et est enregistré **globalement** dans `app.module.ts`, en dernière position de la chaîne.
- Le décorateur `@Permissions()` (`common/decorators/permissions.decorator.ts`) **existe**.
- Les permissions **existent en base** : modèle `Permission`, table de liaison `RolePermission`, 8 permissions peuplées par le seed et rattachées aux rôles.
- Les permissions sont **présentes dans le JWT** (visible dans le payload : `"permissions": [...]`).
- **Aucun endpoint du backend n'utilise `@Permissions()`** — recherche exhaustive sur `apps/api/src` : 0 occurrence hors la définition du décorateur et le guard lui-même.

**Conséquence** : le contrôle d'accès effectif repose **entièrement sur `@Roles`**. Les permissions sont calculées, transportées et stockées, mais jamais évaluées.

---

## I. Endpoints sans `@Roles` (10 routes, 14 endpoints listés ci-dessous)

Ces endpoints n'ont **ni `@Roles` de classe ni `@Roles` de méthode** : tout compte authentifié y accède au niveau controller. Le périmètre est assuré **dans la logique de service**.

| Route | Controller | Handler | Périmètre assuré par | Test |
|---|---|---|---|---|
| `POST /api/v1/requetes` | `requete.controller.ts` | `create` | Service : 403 si le compte n'a pas de profil `Personnel` | I ✓ |
| `GET /api/v1/requetes` | `requete.controller.ts` | `findAll` | Service : demandeur → ses requêtes ; TECHNICIEN → son sous-service ; RESPONSABLE_IT/ADMIN → tout | I ✓ |
| `GET /api/v1/requetes/:id` | `requete.controller.ts` | `findOne` | Service : `assertCanViewRequete` → 403 hors périmètre | I ✓ |
| `GET /api/v1/requetes/:requeteId/interventions` | `intervention.controller.ts` | `findAllForRequete` | Service : même contrôle de périmètre que la requête parente | I ✓ |
| `GET /api/v1/cours-support-it` | `cours.controller.ts` | `findAll` | Aucun filtrage (catalogue ouvert à tout authentifié) | I ✓ |
| `GET /api/v1/cours-support-it/:id` | `cours.controller.ts` | `findOne` | Aucun filtrage | I ✓ |
| `POST /api/v1/cours-support-it/:coursId/inscriptions` | `inscription-enrollment.controller.ts` | `enroll` | Auto-inscription : l'utilisateur ne peut inscrire que lui-même | I ✓ |
| `GET /api/v1/inscriptions-support-it` | `inscription.controller.ts` | `findAll` | Service : filtre sur l'utilisateur courant sauf RESPONSABLE_IT/ADMIN | I ✓ |
| `GET /api/v1/inscriptions-support-it/:id` | `inscription.controller.ts` | `findOne` | Service : 403 hors périmètre | I ✓ |
| `GET /api/v1/postes` · `GET /api/v1/postes/:id` · `GET /api/v1/postes/stats/disponibilite` | `poste.controller.ts` | `findAll`, `findOne`, `disponibiliteParSalle` | Aucun filtrage (consultation ouverte) | I ✓ |
| `POST /api/v1/messages` · `GET /messages/recus` · `GET /messages/envoyes` · `GET /messages/:id` | `message.controller.ts` | `create`, `findRecus`, `findEnvoyes`, `findOne` | Service : expéditeur/destinataire uniquement, 403 sinon | I ✓ |

**Statut** : non tranché. Le filtrage service est présent et couvert par des tests d'intégration, mais la protection n'est pas lisible depuis le controller.

---

## J. Contradictions / décisions requises

| ID | Niveau | Sujet | Constat | Décision requise |
|---|---|---|---|---|
| **CONTRA-01** | Importante | Audit métier | `CLAUDE.md` impose la journalisation de « toutes les mutations create/update/delete ». Réel : `AuditLog` couvre **uniquement l'authentification** (3 appels dans `auth.service.ts`). **17 services / 45 mutations** sans traçabilité, dont `users`/`roles`/`permissions`. 2 modules ont un historique métier dédié (Registration, NoteEtudiant). | Étendre `AuditLog` aux mutations métier **ou** amender explicitement la règle dans `CLAUDE.md` |
| **CONTRA-02** | Importante | Pagination | `CLAUDE.md` impose une pagination systématique. Réel : **9 endpoints de collection non paginés**, dont **4 ont un consommateur frontend** nécessitant une évolution contractuelle coordonnée. | Compléter la pagination ; trancher le séquencement backend→frontend pour les 4 endpoints breaking |
| **CONTRA-03** | Mineure | Docker Moodle | `docker/moodle-service.Dockerfile` : chemin source erroné (`apps/moodle-service`, réel `services/moodle-service`), `npm`/`node:18-alpine` au lieu de `pnpm`/`node:20-alpine`, référencé nulle part dans `docker-compose.yml` | Corriger et brancher **ou** supprimer |
| **CONTRA-04** | Moyenne | Permissions dormantes | `PermissionsGuard` global + permissions en base + dans le JWT, mais `@Permissions()` **utilisé sur 0 endpoint**. RBAC effectif = rôles seuls, alors que `CLAUDE.md` décrit un « RBAC fin » rôle + permission. | Activer réellement le contrôle par permission **ou** acter que le RBAC V1 reste volontairement par rôle |
| **CONTRA-05** | Faible | Endpoints sans `@Roles` | 10 routes accessibles à tout compte authentifié au niveau controller ; périmètre assuré uniquement dans les services (présent et testé). | Conserver ce modèle **ou** expliciter des `@Roles()` au niveau controller |
| **CONTRA-06** | Élevée (dette de test) | Tests Identity | `users`, `roles`, `permissions` : **20 endpoints, zéro test** — les modules les plus sensibles du backend. | Priorisation requise |

---

## K. Parallélisation / conflits potentiels

### BACK-01 — Audit métier (`AuditLog`)

| | |
|---|---|
| **Fichiers concernés** | 17 fichiers `*.service.ts` répartis sur **7 modules** (identity ×3, scolarité ×1, pédagogie ×2, bibliothèque ×5, support-it ×5, messagerie ×1) |
| **Contrats modifiés** | Aucun contrat HTTP — écritures internes uniquement |
| **Fichier commun probable** | Si un helper/décorateur/interceptor d'audit est introduit, il deviendra un point de contention identique à `pagination.dto.ts` |
| **Conflit avec BACK-02** | ⚠️ **Oui, recouvrement de fichiers réel** : `ouvrage.service.ts`, `emprunt.service.ts`, `document-academique.service.ts`, `cours-classe.service.ts`, `epreuve.service.ts`, `note-etudiant.service.ts`, `roles.service.ts`, `permissions.service.ts`, `abonne.service.ts` sont touchés par **les deux** chantiers |
| **Branche indépendante ?** | **Non, pas en parallèle de BACK-02** — les deux modifient les mêmes services. Séquencer. |

> ⚠️ Le raisonnement « fonctionnalités différentes donc parallélisables » est **faux ici** : BACK-01 modifie les méthodes de service (ajout d'écriture d'audit), BACK-02 modifie ces mêmes méthodes (signature de retour paginé). Conflits de merge quasi certains sur 9 fichiers.

### BACK-02 — Pagination

`common/dto/pagination.dto.ts` est importé par 9 modules : **ne pas en conclure que les 9 endpoints sont parallélisables**. En pratique le fichier lui-même n'a pas besoin d'être modifié (il suffit d'étendre `PaginationDto` dans les DTOs cibles), mais toute évolution de ce fichier serait bloquante pour tous.

#### Groupe A — backend uniquement (5 endpoints, aucun consommateur frontend)

`/ouvrages` · `/emprunts` · `/documents-academiques` · `/epreuves` · `/abonnes`

| | |
|---|---|
| **Fichiers** | 4 DTOs de query (+ 1 DTO à créer pour `/abonnes`), 5 services, 5 controllers, DTOs de réponse paginés |
| **Modules** | Bibliothèque (×4), Pédagogie (×1) |
| **Branche indépendante ?** | **Oui** — 100 % backend, aucune coordination frontend |

#### Groupe B — backend **puis** frontend (4 endpoints breaking)

`/cours-classes` · `/notes-etudiant` · `/roles` · `/permissions`

| | |
|---|---|
| **Fichiers backend** | 2 DTOs de query (+ 2 DTOs à créer pour `/roles` et `/permissions`), 4 services, 4 controllers |
| **Fichiers frontend** | `apps/web/src/app/enseignant/page.tsx`, `apps/web/src/app/admin/_components/IdentityManagement.tsx` |
| **Contrainte** | Règle CLAUDE.md : **jamais frontend + backend sur la même branche** → **2 branches séquentielles obligatoires**, backend mergé et stabilisé avant la branche frontend |
| **Risque** | Fenêtre de casse entre le merge backend et le merge frontend : pendant cet intervalle, `/enseignant` et `/admin/parametres` sont cassés en production si les deux ne sont pas déployés ensemble → **décision de déploiement requise** (feature flag, déploiement couplé, ou tolérance des deux formats côté backend le temps de la transition) |
| **Branche indépendante ?** | **Non** — séquencement strict backend → frontend |

### BACK-06 — Tests Identity

| | |
|---|---|
| **Fichiers** | Nouveaux fichiers `*.spec.ts` / `*.integration-spec.ts` pour `users`, `roles`, `permissions` — **création pure, aucune modification de code applicatif** |
| **Conflit avec BACK-01** | Faible mais réel : BACK-01 modifiera `users/roles/permissions.service.ts`, donc des tests écrits avant devront être ajustés (ajout d'assertions d'audit) |
| **Conflit avec BACK-02 Groupe B** | Réel : paginer `/roles` et `/permissions` change le contrat que les tests vérifieraient |
| **Branche indépendante ?** | **Oui techniquement**, mais **à faire soit avant les deux (les tests deviennent le filet de sécurité des refactors), soit après les deux (pour ne pas les réécrire)**. Le faire *pendant* est le pire cas. |

---

## L. Ordre de traitement — analyse (pas une décision)

Cet ordre découle des dépendances de fichiers constatées, pas d'une préférence :

1. **BACK-06 (tests Identity) d'abord** — 20 endpoints sensibles sans filet. Création pure de fichiers, zéro conflit avec l'existant, et fournit le filet de sécurité pour les deux chantiers suivants qui vont modifier ces mêmes services.
2. **BACK-02 Groupe A** (5 endpoints backend pur) — indépendant, faible risque, valide le pattern de pagination sur des endpoints sans consommateur.
3. **BACK-02 Groupe B backend**, puis **Groupe B frontend** (2 branches séquentielles) — nécessite d'abord une **décision de déploiement** sur la fenêtre de casse.
4. **BACK-01 (audit métier)** en dernier sur les services concernés, pour éviter les conflits de merge avec BACK-02 sur 9 fichiers communs.
5. **BACK-03 (Docker Moodle)** — indépendant de tout, à n'importe quel moment.

**Décisions à prendre avant de lancer quoi que ce soit** : CONTRA-04 (permissions : activer ou acter le rôle-seul), CONTRA-05 (endpoints sans `@Roles`), et la stratégie de déploiement pour BACK-02 Groupe B.
