# Plan d'implémentation verrouillé — Backend ISSEG

> **Source unique** : `design-plans/backend-audit-reference.md` (état constaté le 2026-09-05 sur `main` @ `7cae264`).
> **Nature** : plan verrouillé. Chaque chantier a un scope fermé, une liste de fichiers autorisés **exhaustive**, et une condition d'arrêt obligatoire.
> **Aucun agent n'a le droit de prendre une décision architecturale.** En cas de divergence avec la référence : ARRÊT + rapport.

---

## 0. Règles de gouvernance applicables à TOUS les agents

Ces règles sont non négociables et doivent être reprises intégralement dans le prompt de chaque agent.

1. **Scope fermé** — l'agent ne modifie QUE les fichiers listés dans « Fichiers autorisés ». Toucher un fichier hors liste = violation, même si le changement paraît trivial ou nécessaire.
2. **Arrêt sur divergence** — si l'état réel du code diverge de ce que décrit ce plan (fichier absent, signature différente, DTO inexistant, test déjà présent, comportement inattendu), l'agent **s'arrête immédiatement**, ne corrige rien, et rapporte : ce qui était attendu, ce qui a été trouvé, le fichier, et l'impact estimé.
3. **Aucune décision architecturale** — pas de nouveau pattern, pas de nouvelle abstraction, pas de refactor opportuniste, pas de dépendance ajoutée, pas de renommage. Si le plan ne dit pas quoi faire : ARRÊT + question.
4. **Aucun commit, aucun push** — l'agent laisse ses modifications non commitées. L'agent principal contrôle le diff puis committe.
5. **Base de données** — aucune migration, aucun seed, aucune commande touchant la base de dev `isseg` sans autorisation explicite écrite dans le chantier. Les tests d'intégration ciblent exclusivement `TEST_DATABASE_URL`.
6. **Vérifications de fin obligatoires** — `pnpm exec tsc --noEmit` (exit 0), `git diff --check`, `git status --short`, et la liste des fichiers touchés doit correspondre **exactement** à « Fichiers autorisés ».
7. **Règle du dépôt** — jamais frontend + backend sur la même branche (`CLAUDE.md`). Une branche = un chantier.

---

## 1. Décisions bloquantes

Aucun chantier bloqué par une décision ne peut démarrer avant arbitrage écrit du propriétaire du projet.

### DEC-01 — Portée de l'audit métier · **bloque BACK-01**

> `CLAUDE.md` impose la journalisation de « toutes les mutations ». Réel : 17 services / 45 mutations sans trace.

**Fait nouveau non couvert par la référence** : `AuditAction` ne contient que **8 valeurs, toutes liées à l'authentification** (`LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `TOKEN_REFRESHED`, `TOKEN_REVOKED`, `ACCOUNT_LOCKED`, `ACCOUNT_UNLOCKED`, `PASSWORD_CHANGED`). Il n'existe **aucune valeur générique de mutation**. De plus, `createAuditLog` est une **méthode privée de `auth.service.ts`**, non réutilisable.

Conséquence : **BACK-01 n'est pas un chantier « code seul »** — il impose une modification du schéma Prisma **et une migration**.

| Sous-décision | Options | Impact |
|---|---|---|
| **DEC-01a** — principe | (A) Étendre `AuditLog` aux mutations métier · (B) Amender `CLAUDE.md` pour restreindre la règle à l'authentification + historiques métier dédiés | (B) supprime BACK-01 entièrement |
| **DEC-01b** — enum (si A) | (A1) Valeurs génériques : `ENTITY_CREATED` / `ENTITY_UPDATED` / `ENTITY_DELETED` + `entityType` dans `details` (Json, déjà présent) → **3 valeurs, 1 migration** · (A2) Valeurs spécifiques par entité (`USER_CREATED`, `ROLE_ASSIGNED`…) → **~40 valeurs, 1 migration, enum verbeux** | A1 = migration minimale, requêtabilité par `details`; A2 = requêtable par enum, mais l'enum grossit à chaque entité |
| **DEC-01c** — implémentation (si A) | (C1) Extraire un `AuditService` partagé dans `src/common/audit/` injecté dans les 17 services · (C2) Appels `prisma.auditLog.create` inline dans chaque service, sur le modèle de `auth.service.ts` | C1 = 1 nouveau point de contention transverse, mais DRY; C2 = zéro fichier partagé, mais duplication ×17 |
| **DEC-01d** — migration | Autorisation explicite d'exécuter `prisma migrate dev` sur la base dev `isseg` | Requis par la règle mémoire « ne jamais migrer/seeder `isseg` sans accord » |

**Recommandation (non appliquée sans ton accord)** : A + A1 + C1 + autorisation ponctuelle de migration. A1 limite la migration à 3 valeurs d'enum ; C1 évite 17 duplications d'un code sensible.

### DEC-02 — Stratégie de déploiement du changement de contrat · **bloque BACK-02-B1 et B2**

Paginer `/cours-classes`, `/notes-etudiant`, `/roles`, `/permissions` transforme la réponse de `T[]` en `{data, meta}`. Le frontend les consomme en tableau nu. `apiFetch<T>` étant un simple cast, **la casse est invisible à la compilation et n'apparaît qu'à l'exécution**. La règle « jamais frontend + backend sur la même branche » impose deux merges distincts → une fenêtre pendant laquelle `/enseignant` et `/admin/parametres` seraient cassés en production.

| Option | Description | Coût |
|---|---|---|
| **(A) Déploiement couplé** | Les 2 PR sont mergées puis déployées ensemble, jamais séparément | Discipline de release ; zéro code jetable |
| **(B) Backend tolérant transitoire** | Le backend accepte `?paginated=true` et ne renvoie `{data, meta}` que dans ce cas ; le frontend migre ; puis on retire le paramètre | Code transitoire à retirer (3 PR au lieu de 2) |
| **(C) Nouveaux endpoints versionnés** | `/api/v2/roles` paginé, `/api/v1/roles` inchangé | Duplication durable, versioning à maintenir |

**Recommandation** : (A) si tu contrôles le déploiement (le cas ici : merge → déploiement manuel) ; (B) seulement si backend et frontend peuvent être déployés séparément.

### DEC-03 — Permissions (CONTRA-04) · **ne bloque aucun chantier de ce plan**

`@Permissions()` sur 0 endpoint. Décision : activer le contrôle par permission, ou acter que le RBAC V1 reste par rôle et amender `CLAUDE.md`. **Aucun chantier n'est ouvert ici tant que la décision n'est pas prise** — c'est un chantier futur (BACK-04), volontairement hors de ce plan.

### DEC-04 — Endpoints sans `@Roles` (CONTRA-05) · **ne bloque aucun chantier de ce plan**

10 routes ouvertes à tout compte authentifié, périmètre assuré en service (testé). Décision : conserver, ou expliciter. Chantier futur (BACK-05), hors de ce plan.

### DEC-05 — Dockerfile Moodle (CONTRA-03) · **bloque BACK-03**

Corriger et brancher dans `docker-compose.yml`, **ou** supprimer le fichier. Sans arbitrage, BACK-03 ne démarre pas.

---

## 2. Chantiers

### BACK-06 — Tests Identity

| | |
|---|---|
| **Agent** | `AGENT-TEST-IDENTITY` |
| **Gate** | Aucun — peut démarrer immédiatement |
| **Objectif** | Couvrir les 20 endpoints `users` / `roles` / `permissions`, aujourd'hui sans aucun test |
| **Branche** | `test/identity-coverage` (depuis `main` à jour) |

**Fichiers autorisés — création uniquement** :
```
apps/api/src/identity/users/users.service.spec.ts
apps/api/src/identity/users/users.service.integration-spec.ts
apps/api/src/identity/roles/roles.service.spec.ts
apps/api/src/identity/roles/roles.service.integration-spec.ts
apps/api/src/identity/permissions/permissions.service.spec.ts
apps/api/src/identity/permissions/permissions.service.integration-spec.ts
```

**Fichiers interdits** : tout le reste, en particulier `users.service.ts`, `roles.service.ts`, `permissions.service.ts`, les controllers, les DTOs, le schéma Prisma. **Aucune modification de code applicatif, même pour corriger un bug découvert.**

**Contrat API** : inchangé (chantier de test pur).

**Tests obligatoires** — au minimum, par service :
- `users` : création (succès + 409 email dupliqué), mise à jour, `estActif` toggle, soft-delete (204 + révocation de session), changement de mot de passe (hash bcrypt vérifié, sessions révoquées), attribution et retrait de rôle, pagination de `findAll` (`meta.total`, `totalPages`).
- `roles` : CRUD complet, 409 sur nom dupliqué, 409 sur suppression d'un rôle encore attribué, attribution/retrait de permission.
- `permissions` : CRUD complet, 409 sur nom dupliqué, 409 sur suppression d'une permission encore rattachée.

**Critères de validation** :
- `pnpm --filter api test` → PASS, et le nombre de tests augmente d'au moins 30
- `pnpm --filter api test:integration` → aucune régression sur les 141 tests existants
- `tsc --noEmit` exit 0
- `git status --short` : exactement les 6 fichiers créés, aucun autre

**Condition d'arrêt spécifique** : si un test révèle un comportement du service contraire à ce que décrit la référence (§D endpoints Identity), **ne pas corriger le service** — écrire le test tel qu'il devrait être, le marquer `.skip` avec un commentaire `// BLOQUÉ: divergence, voir rapport`, et rapporter.

---

### BACK-02-A — Pagination (5 endpoints sans consommateur frontend)

| | |
|---|---|
| **Agent** | `AGENT-PAGINATION-A` |
| **Gate** | Aucun |
| **Objectif** | Aligner 5 endpoints de collection sur `PaginationDto`, sans aucune coordination frontend |
| **Branche** | `feat/pagination-backend-only` (depuis `main` à jour) |

**Endpoints concernés** : `/ouvrages`, `/emprunts`, `/documents-academiques`, `/epreuves`, `/abonnes`

**Fichiers autorisés** :
```
# Ouvrages
apps/api/src/bibliotheque/ouvrages/dto/list-ouvrage-query.dto.ts
apps/api/src/bibliotheque/ouvrages/dto/ouvrage.response.dto.ts
apps/api/src/bibliotheque/ouvrages/ouvrage.service.ts
apps/api/src/bibliotheque/ouvrages/ouvrage.controller.ts
apps/api/src/bibliotheque/ouvrages/ouvrage.service.spec.ts
# Emprunts
apps/api/src/bibliotheque/emprunts/dto/list-emprunt-query.dto.ts
apps/api/src/bibliotheque/emprunts/dto/emprunt.response.dto.ts
apps/api/src/bibliotheque/emprunts/emprunt.service.ts
apps/api/src/bibliotheque/emprunts/emprunt.controller.ts
apps/api/src/bibliotheque/emprunts/emprunt.service.spec.ts
apps/api/src/bibliotheque/emprunts/emprunt.service.integration-spec.ts
# Documents académiques
apps/api/src/bibliotheque/documents-academiques/dto/list-document-academique-query.dto.ts
apps/api/src/bibliotheque/documents-academiques/dto/document-academique.response.dto.ts
apps/api/src/bibliotheque/documents-academiques/document-academique.service.ts
apps/api/src/bibliotheque/documents-academiques/document-academique.controller.ts
apps/api/src/bibliotheque/documents-academiques/document-academique.service.spec.ts
# Abonnés (DTO de query À CRÉER — il n'en existe aucun)
apps/api/src/bibliotheque/abonnes/dto/list-abonne-query.dto.ts        ← CRÉATION
apps/api/src/bibliotheque/abonnes/dto/abonne.response.dto.ts
apps/api/src/bibliotheque/abonnes/abonne.service.ts
apps/api/src/bibliotheque/abonnes/abonne.controller.ts
apps/api/src/bibliotheque/abonnes/abonne.service.spec.ts
# Épreuves
apps/api/src/pedagogie/epreuve/dto/list-epreuve-query.dto.ts
apps/api/src/pedagogie/epreuve/dto/list-epreuve-query.dto.spec.ts
apps/api/src/pedagogie/epreuve/dto/epreuve.response.dto.ts
apps/api/src/pedagogie/epreuve/epreuve.service.ts
apps/api/src/pedagogie/epreuve/epreuve.controller.ts
apps/api/src/pedagogie/epreuve/epreuve.service.spec.ts
apps/api/src/pedagogie/epreuve/epreuve.controller.spec.ts
apps/api/src/pedagogie/epreuve/epreuve.integration-spec.ts
```

**Fichiers interdits — explicitement** : `common/dto/pagination.dto.ts` (**ne pas modifier**, seulement l'étendre depuis les DTOs), `cours-classe/*`, `note-etudiant/*`, `identity/*`, tout `apps/web/*`, le schéma Prisma, tout fichier Docker.

**Contrat API — avant / après** (identique pour les 5) :

```diff
  GET /api/v1/{ressource}?<filtres existants>
- 200 → {Ressource}ResponseDto[]
+ 200 → { data: {Ressource}ResponseDto[], meta: { total, page, limit, totalPages } }
+ Nouveaux paramètres : ?page=1&limit=20  (défauts PaginationDto, limit plafonné à 100)
```
Les filtres existants de chaque DTO sont **conservés à l'identique**. Aucun champ de `{Ressource}ResponseDto` n'est modifié.

**Tests obligatoires** : pour chacun des 5 endpoints — page par défaut (`page=1, limit=20`), `meta.total` cohérent avec le nombre réel, dernière page partielle, `limit` > 100 rejeté ou plafonné conformément à `PaginationDto`, combinaison pagination + filtre existant.

**Critères de validation** : `tsc --noEmit` = 0 · `pnpm --filter api test` PASS · `pnpm --filter api test:integration` PASS · diff limité aux fichiers listés · `grep -rn "apiFetch" apps/web` inchangé (preuve qu'aucun consommateur frontend n'existe).

**Condition d'arrêt spécifique** : si un de ces 5 endpoints s'avère consommé par `apps/web` (contrairement à la référence §F.2), **ARRÊT immédiat** — il bascule dans le périmètre B, qui a une autre stratégie.

---

### BACK-02-B1 — Pagination backend des 4 endpoints à contrat cassant

| | |
|---|---|
| **Agent** | `AGENT-PAGINATION-B1` |
| **Gate** | **DEC-02 arbitrée** + **BACK-06 mergé** |
| **Objectif** | Paginer `/cours-classes`, `/notes-etudiant`, `/roles`, `/permissions` côté backend uniquement |
| **Branche** | `feat/pagination-breaking-backend` (depuis `main` à jour, **après** merge de BACK-06 et BACK-02-A) |

**Fichiers autorisés** :
```
# Cours-classes
apps/api/src/pedagogie/cours-classe/dto/list-cours-classe-query.dto.ts
apps/api/src/pedagogie/cours-classe/dto/cours-classe.response.dto.ts
apps/api/src/pedagogie/cours-classe/cours-classe.service.ts
apps/api/src/pedagogie/cours-classe/cours-classe.controller.ts
apps/api/src/pedagogie/cours-classe/cours-classe.service.spec.ts
apps/api/src/pedagogie/cours-classe/cours-classe.integration-spec.ts
# Notes étudiant
apps/api/src/pedagogie/note-etudiant/dto/list-note-etudiant-query.dto.ts
apps/api/src/pedagogie/note-etudiant/dto/note-etudiant.response.dto.ts
apps/api/src/pedagogie/note-etudiant/note-etudiant.service.ts
apps/api/src/pedagogie/note-etudiant/note-etudiant.controller.ts
apps/api/src/pedagogie/note-etudiant/note-etudiant.service.spec.ts
apps/api/src/pedagogie/note-etudiant/note-etudiant.controller.spec.ts
apps/api/src/pedagogie/note-etudiant/note-etudiant.integration-spec.ts
# Roles (DTO de query À CRÉER)
apps/api/src/identity/roles/dto/list-role-query.dto.ts                ← CRÉATION
apps/api/src/identity/roles/dto/role.response.dto.ts
apps/api/src/identity/roles/roles.service.ts
apps/api/src/identity/roles/roles.controller.ts
apps/api/src/identity/roles/roles.service.spec.ts                     ← créé par BACK-06, mise à jour autorisée
apps/api/src/identity/roles/roles.service.integration-spec.ts         ← créé par BACK-06, mise à jour autorisée
# Permissions (DTO de query À CRÉER)
apps/api/src/identity/permissions/dto/list-permission-query.dto.ts    ← CRÉATION
apps/api/src/identity/permissions/dto/permission.response.dto.ts
apps/api/src/identity/permissions/permissions.service.ts
apps/api/src/identity/permissions/permissions.controller.ts
apps/api/src/identity/permissions/permissions.service.spec.ts         ← créé par BACK-06, mise à jour autorisée
apps/api/src/identity/permissions/permissions.service.integration-spec.ts ← idem
```

**Fichiers interdits — explicitement** : **tout `apps/web/**`** (c'est B2), `common/dto/pagination.dto.ts`, les modules de BACK-02-A, `users.*` (seuls `roles` et `permissions` sont dans le périmètre), le schéma Prisma.

**Contrat API — avant / après** :

| Endpoint | Avant | Après |
|---|---|---|
| `GET /api/v1/cours-classes` | `CoursClasseResponseDto[]` | `{ data: CoursClasseResponseDto[], meta }` |
| `GET /api/v1/notes-etudiant` | `NoteEtudiantResponseDto[]` | `{ data: NoteEtudiantResponseDto[], meta }` |
| `GET /api/v1/roles` | `RoleResponseDto[]` | `{ data: RoleResponseDto[], meta }` |
| `GET /api/v1/permissions` | `PermissionResponseDto[]` | `{ data: PermissionResponseDto[], meta }` |

Si **DEC-02 = option (B)**, le contrat devient conditionnel : `?paginated=true` → `{data, meta}`, sinon `T[]` inchangé. L'agent applique **strictement** l'option retenue, sans initiative.

**Tests obligatoires** : mêmes cas que BACK-02-A, plus mise à jour des specs Identity créées par BACK-06 pour refléter le nouveau contrat.

**Critères de validation** : `tsc --noEmit` = 0 · suites unitaire et intégration PASS · **`git diff --stat` ne contient aucun fichier sous `apps/web/`** · le diff correspond exactement à la liste.

**Condition d'arrêt spécifique** : si l'agent constate qu'un consommateur frontend supplémentaire existe au-delà des 4 documentés en §F.1, ARRÊT + rapport (le périmètre de B2 changerait).

---

### BACK-02-B2 — Adaptation frontend

| | |
|---|---|
| **Agent** | `AGENT-PAGINATION-B2` |
| **Gate** | **BACK-02-B1 mergé sur `main`** |
| **Objectif** | Adapter les 2 fichiers frontend au nouveau contrat |
| **Branche** | `feat/pagination-breaking-frontend` (depuis `main` **après** merge de B1) |

**Fichiers autorisés** :
```
apps/web/src/app/enseignant/page.tsx
apps/web/src/app/admin/_components/IdentityManagement.tsx
```

**Fichiers interdits** : **tout `apps/api/**`**, `apps/web/src/lib/usePaginatedFetch.ts` (à consommer tel quel, pas à modifier), `packages/**`, tout autre écran.

**Contrat consommé — avant / après** :
```diff
- const data = await apiFetch<CoursClasse[]>("/cours-classes", { token });
- setCours(data);
+ const res = await apiFetch<{ data: CoursClasse[]; meta: PaginationMeta }>("/cours-classes", { token });
+ setCours(res.data);
```
Idem pour `/notes-etudiant` (`enseignant/page.tsx`), `/roles` et `/permissions` (`IdentityManagement.tsx`).

**Contrainte responsive** : `.claude/agent-responsive-design.md` s'applique (375 / 768 / 1280 px) si l'UI change. Si l'adaptation reste une simple extraction de `res.data`, aucun impact responsive.

**Tests obligatoires** : `tsc --noEmit` = 0 · test navigateur manuel sur `/enseignant` (onglets Mes cours + Notes, édition inline d'une note fonctionnelle) et `/admin/parametres` (onglets Utilisateurs / Rôles / Permissions, panneau « Gérer les rôles » fonctionnel) · console sans erreur.

**Condition d'arrêt spécifique** : si le backend en `main` ne renvoie **pas** encore `{data, meta}` (B1 non mergé), ARRÊT immédiat — ne pas « anticiper » le contrat.

---

### BACK-01 — Audit métier

| | |
|---|---|
| **Agent** | `AGENT-AUDIT-TRAIL` |
| **Gate** | **DEC-01a/b/c/d arbitrées** + **BACK-02-A et BACK-02-B1 mergés** |
| **Objectif** | Journaliser les mutations métier des 17 services identifiés |
| **Branche** | `feat/audit-trail-metier` |

**Pourquoi en dernier** : BACK-01 modifie 9 fichiers de service **également modifiés par BACK-02** (`ouvrage`, `emprunt`, `document-academique`, `epreuve`, `abonne`, `cours-classe`, `note-etudiant`, `roles`, `permissions`). Lancer les deux en parallèle produit des conflits de merge quasi certains.

**Périmètre** : 17 services / 45 mutations, listés en §G de la référence. `registration-workflow.service.ts` et `note-etudiant.service.ts` conservent en plus leurs historiques métier existants (`registrationHistory`, `noteEtudiantHistory`) — **ne pas les remplacer**.

**Fichiers autorisés** : à figer **après DEC-01**, car ils dépendent de l'option retenue :
- Si **DEC-01c = C1** : création de `apps/api/src/common/audit/audit.service.ts` + `audit.module.ts` + `audit.service.spec.ts`, puis les 17 `*.service.ts` + leurs modules pour l'injection.
- Si **DEC-01c = C2** : uniquement les 17 `*.service.ts` + leurs specs.
- Dans les deux cas, si **DEC-01b = A1** : `apps/api/prisma/schema.prisma` (ajout de 3 valeurs d'enum) + le dossier de migration généré.

**Autorisation base de données** : requise (DEC-01d). Sans elle, l'agent s'arrête avant `prisma migrate dev`.

**Tests obligatoires** : pour chaque service modifié, au moins un test vérifiant qu'une mutation réussie écrit bien une ligne `AuditLog` avec le bon `utilisateurId`, la bonne `action` et un `details` exploitable ; et qu'une mutation échouée n'en écrit pas.

**Condition d'arrêt spécifique** : si le nombre réel de mutations diverge des 45 recensés, ou si un service utilise un pattern de transaction incompatible avec l'écriture d'audit (ex. `$transaction` interactif), ARRÊT + rapport avant de continuer.

---

### BACK-03 — Dockerfile Moodle

| | |
|---|---|
| **Agent** | `AGENT-DOCKER-MOODLE` |
| **Gate** | **DEC-05 arbitrée** (corriger ou supprimer) |
| **Branche** | `chore/docker-moodle-service` |
| **Fichiers autorisés** | `docker/moodle-service.Dockerfile` · `docker-compose.yml` (uniquement si DEC-05 = corriger + brancher) |
| **Fichiers interdits** | `apps/**`, `packages/**`, `services/moodle-service/**` (le code du service n'est pas dans le périmètre), les autres Dockerfiles |
| **Validation** | Si corriger : `docker compose config` valide + build de l'image réussi. Si supprimer : `grep -rn "moodle-service.Dockerfile"` ne renvoie plus rien. |

---

## 2 bis. Règles permanentes d'exécution des agents

Ajoutées après la vague 1, à la suite de deux incidents réels.

**R1 — Un seul agent à la fois sur la base de test.** La suite d'intégration partage
`isseg_test` et chaque suite appelle `truncateAll`. Deux agents qui la lancent en parallèle se
détruisent mutuellement les données et produisent de faux échecs de clé étrangère, sans rapport
avec le code testé. La garantie de non-chevauchement des **fichiers** ne dit rien du
chevauchement d'**état de base**. Soit les phases de tests d'intégration sont sérialisées, soit
chaque agent reçoit sa propre base. Les tests unitaires sont mockés et restent parallélisables.
Corollaire : un rapport d'agent annonçant des échecs d'intégration alors qu'un autre agent
tournait doit être rejoué en série avant d'être cru.

**R2 — Les variables de base de données sont hors périmètre de tout agent.** Aucun agent ne
modifie `DATABASE_URL` ni `TEST_DATABASE_URL` sans chantier explicite le prévoyant. État figé :

```
DATABASE_URL       → inchangé
TEST_DATABASE_URL  → postgresql://…@localhost:5432/isseg_test  (conteneur isseg-postgres)
```

Neon n'est plus utilisé pour les tests depuis le 2026-09-05. La suite d'intégration complète
tourne en 395 s en local.

---

## 3. Ordre exact d'exécution

```
VAGUE 1  (parallélisable — jeux de fichiers disjoints, vérifié §4)
  ├── BACK-06        test/identity-coverage            ✅ MERGÉ (e400ed4)
  ├── BACK-02-A      feat/pagination-backend-only      ✅ MERGÉ (e28ed73)
  └── BACK-03        chore/docker-moodle-service       [gate DEC-05 — non lancé]
         ↓ merge des 2 sur main : 20 suites / 204 tests d'intégration PASS
VAGUE 2  (BACK-07 et B1 parallélisables — jeux de fichiers disjoints, vérifié)
  ├── BACK-07        fix/refresh-token-revocation      [aucun gate]
  └── BACK-02-B1     feat/pagination-breaking-backend  [gate DEC-02]
         ↓ merge
VAGUE 3  (séquentiel, obligatoirement après merge de B1)
  └── BACK-02-B2     feat/pagination-breaking-frontend [gate B1 mergé]
         ↓ merge — DÉPLOIEMENT COUPLÉ B1+B2 si DEC-02 = option A
VAGUE 4  (séquentiel, en dernier)
  └── BACK-01        feat/audit-trail-metier           [gate DEC-01 complet + BACK-07 mergé]
```

**Chantiers hors plan, à ouvrir après décision** : BACK-04 (permissions, DEC-03) · BACK-05 (`@Roles` explicites, DEC-04).

---

## 4. Matrice de non-chevauchement

Vérification que les chantiers d'une même vague ne partagent aucun fichier.

| Chantier | Domaines de fichiers | BACK-06 | BACK-02-A | BACK-03 | BACK-02-B1 | BACK-02-B2 | BACK-01 |
|---|---|---|---|---|---|---|---|
| **BACK-06** | `identity/{users,roles,permissions}/*.spec.ts` (créations) | — | ∅ | ∅ | ⚠️ B1 met à jour 4 specs créées ici | ∅ | ⚠️ |
| **BACK-02-A** | `bibliotheque/{ouvrages,emprunts,documents-academiques,abonnes}`, `pedagogie/epreuve` | ∅ | — | ∅ | ∅ | ∅ | ⚠️ 5 services communs |
| **BACK-03** | `docker/` | ∅ | ∅ | — | ∅ | ∅ | ∅ |
| **BACK-02-B1** | `pedagogie/{cours-classe,note-etudiant}`, `identity/{roles,permissions}` | ⚠️ | ∅ | ∅ | — | ∅ | ⚠️ 4 services communs |
| **BACK-02-B2** | `apps/web` (2 fichiers) | ∅ | ∅ | ∅ | ∅ | — | ∅ |
| **BACK-01** | 17 `*.service.ts` (7 modules) + éventuellement Prisma | ⚠️ | ⚠️ | ∅ | ⚠️ | ∅ | — |

`∅` = aucun fichier commun, parallélisation sûre. `⚠️` = fichiers communs, **séquencement obligatoire**.

**Conclusion** : la vague 1 est sûre (BACK-06 ∥ BACK-02-A ∥ BACK-03 : trois jeux de fichiers strictement disjoints). Tout le reste est séquentiel.

---

## 5. Stratégie de branche et de merge

**Branche** : une branche par chantier, créée depuis `main` **à jour au moment du démarrage du chantier** (`git checkout main && git pull --ff-only && git checkout -b <branche>`). Jamais de branche depuis une autre branche de chantier.

**Isolation des agents** : chaque agent travaille dans un **git worktree isolé**. Attention — `isolation: "worktree"` ne part pas de la branche courante de la session : l'agent doit, en **première action**, exécuter `git fetch origin && git checkout -b <branche> origin/main` (ou `git merge --ff-only <branche>` si la branche existe déjà et est verrouillée par un autre worktree).

**Merge** :
1. L'agent ne committe pas. Il rapporte.
2. L'agent principal contrôle le diff **fichier par fichier** contre la liste « Fichiers autorisés ». Un fichier hors liste = rejet du chantier, pas de correction à la volée.
3. L'agent principal committe (message en français, conventions du dépôt), pousse, ouvre la PR.
4. Merge par PR sur `main` (merge commit, conforme à l'historique existant `Merge pull request #N`).
5. Après merge : suppression de la branche locale et distante, mise à jour de `main` local.
6. **Cas particulier B1/B2** : si DEC-02 = option (A), les deux PR sont mergées à la suite et **déployées ensemble** ; ne jamais déployer B1 seul en production.

---

## 6. Contrat de prompt agent (à reprendre tel quel)

Chaque prompt d'agent doit contenir, en plus de son chantier :

```
SCOPE FERMÉ
- Tu ne modifies QUE les fichiers de la liste « Fichiers autorisés ». Aucune exception.
- Tout fichier hors liste est interdit, même pour une correction évidente.

ARRÊT SUR DIVERGENCE (obligatoire)
Si l'état réel du code diverge de ce que décrit ce chantier — fichier absent, signature
différente, DTO inexistant, test déjà présent, comportement inattendu, contrat différent
de celui documenté — tu t'ARRÊTES immédiatement :
- tu ne corriges rien,
- tu ne choisis pas entre deux interprétations,
- tu ne « complètes » pas le plan par déduction,
- tu rapportes : attendu / trouvé / fichier / impact estimé / décision requise.

INTERDICTIONS
- Aucune décision architecturale, aucun nouveau pattern, aucune abstraction non prescrite.
- Aucune dépendance ajoutée, aucun renommage, aucun refactor opportuniste.
- Aucun commit, aucun push.
- Aucune migration, aucun seed, aucune commande touchant la base de dev `isseg`.
- Les tests d'intégration ciblent exclusivement TEST_DATABASE_URL.

VÉRIFICATIONS DE FIN (obligatoires, à rapporter)
- pnpm exec tsc --noEmit  → exit 0
- git diff --check        → propre
- git status --short      → correspond EXACTEMENT à « Fichiers autorisés »
- suites de tests exigées par le chantier → PASS

RAPPORT FINAL
Branche · fichiers créés/modifiés · résultat tsc · résultat tests · diff résumé ·
conformité du scope (oui/non + détail) · anomalies · STATUT: VALIDÉ | BLOQUÉ | À RÉVISER
```

---

## 7. Ce qui reste à arbitrer avant tout démarrage

| Décision | Bloque | Sans elle |
|---|---|---|
| **DEC-02** (stratégie de déploiement) | BACK-02-B1, B2 | Vagues 2 et 3 impossibles |
| **DEC-01a/b/c/d** (audit métier + migration) | BACK-01 | Vague 4 impossible |
| **DEC-05** (Dockerfile Moodle) | BACK-03 | BACK-03 retiré de la vague 1 |
| DEC-03 (permissions), DEC-04 (`@Roles`) | rien dans ce plan | Chantiers BACK-04/05 non ouverts |

**Peuvent démarrer immédiatement, sans aucune décision** : **BACK-06** et **BACK-02-A**.
