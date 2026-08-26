# CLAUDE.md

Ce fichier fournit des repères à Claude Code (claude.ai/code) pour travailler sur le code de ce dépôt.

## Aperçu du projet

Plateforme intégrée de gestion et d'administration pour l'**Institut Supérieur des Sciences de l'Éducation de Guinée (ISSEG)** à Conakry. La plateforme couvre l'inscription des étudiants, la pédagogie, les notes, les diplômes, l'intégration LMS/Moodle, la bibliothèque, la finance/RH, et l'administration système.

### Modules principaux
- **Scolarité** : Inscription (intégration Parcoursup), gestion documentaire, abandons/reprises, traitement des diplômes
- **Pédagogie** : Workflow de validation des notes (chaîne de validation à 5 étapes), gestion des cours, intégration LMS
- **Bibliothèque** : Gestion du catalogue, emprunts (avec vérification de régularité), numérisation des thèses/mémoires
- **Départements** : 4 départements (Sciences de l'Éducation, Didactique, Sciences du Langage, Sciences Sociales)
- **Innovation Numérique** : Publications universitaires (ISBN), centre d'innovation pédagogique, support informatique
- **Finance/RH** : Frais de scolarité, paiements en ligne, gestion du personnel

## Architecture monorepo (pnpm + Turborepo)

Ce dépôt est un monorepo géré avec `pnpm workspaces` et orchestré par `turbo`.

### Structure des workspaces

- **`apps/api`** : API REST principale (NestJS 10, ORM Prisma, authentification JWT/RBAC)
  - Point d'entrée : `src/main.ts`
  - Authentification avec rotation des refresh tokens et gestion sécurisée des cookies
  - Swagger UI disponible sur `/api/docs` (hors production uniquement)
  - Préfixe API global : `/api/v1`
  - Modules : `auth`, `identity` (utilisateurs/rôles/permissions), `common` (guards/filtres/décorateurs)

- **`apps/web`** : Application web frontend (Next.js 14, App Router, TailwindCSS)
  - Portail unique pour tous les rôles utilisateurs

- **`apps/worker`** : Traitement asynchrone de tâches (BullMQ/Redis)
  - Génération PDF/Excel, passerelle SMS/Email

- **`services/moodle-service`** : Microservice de synchronisation avec le LMS Moodle
  - Intégration bidirectionnelle avec Moodle

- **`packages/shared`** : Code partagé (Types, DTOs)
- **`packages/ui`** : Composants React partagés
- **`packages/config`** : Configurations communes

## Système de design & guidelines UI

Les tokens de design vivent dans `apps/web/tailwind.config.ts` (`theme.extend.colors`) et sont utilisés
directement comme classes utilitaires Tailwind — les clés de couleur **sont** les noms des tokens, pas de
préfixe `isseg-` :

| Token | Hex | Classes Tailwind |
|---|---|---|
| `navy` | `#0B2559` | `bg-navy`, `text-navy`, `border-navy` |
| `gold` | `#F2A910` | `bg-gold`, `text-gold` |
| `page` | `#F7FAFD` | `bg-page` (fond de page) |
| `status.green` | `#639922` | `bg-status-green`, `text-status-green` (validé) |
| `status.orange` | `#BA7517` | `bg-status-orange`, `text-status-orange` (en attente) |
| `status.red` | `#E24B4A` | `bg-status-red`, `text-status-red` (en retard / erreur) |
| `status.neutral` | `#5F5E5A` | `bg-status-neutral`, `text-status-neutral` |

- **Police** : Inter, chargée via `next/font/google` dans `apps/web/src/app/layout.tsx` — pas de
  `<link>`/`@import` externe (évite le rendu bloquant et la dépendance à un CDN tiers).
- **Composants partagés** (header, sidebar, logo…) vivent dans `packages/ui` (package `@isseg/ui`),
  importés par `apps/web` via `transpilePackages` dans `next.config.mjs` — jamais dupliqués entre
  écrans.
- **Origine** : ces tokens reprennent exactement ceux de la maquette de référence Figma Make
  "Portail de gestion académique". Ce fichier est désormais la **source de vérité** pour le code —
  en cas de divergence future avec Figma, ce fichier fait foi, pas l'inverse.

## Commandes de développement

### Lancer le projet

```bash
# Démarrer tous les services en mode développement
pnpm dev

# Démarrer un workspace spécifique
pnpm --filter api dev        # Backend API uniquement
pnpm --filter web dev        # Frontend uniquement
pnpm --filter worker dev     # Worker uniquement
```

### Gestion de la base de données (Prisma)

```bash
# Appliquer les migrations
DATABASE_URL="postgresql://abdoul:azerty@localhost:5432/isseg?schema=public" pnpm --filter api prisma migrate dev

# Régénérer le client Prisma après une modification du schéma
DATABASE_URL="postgresql://abdoul:azerty@localhost:5432/isseg?schema=public" pnpm --filter api prisma generate

# Ouvrir Prisma Studio (interface graphique DB)
DATABASE_URL="postgresql://abdoul:azerty@localhost:5432/isseg?schema=public" pnpm --filter api prisma studio

# Peupler la base avec un utilisateur admin initial
DATABASE_URL="postgresql://abdoul:azerty@localhost:5432/isseg?schema=public" ADMIN_EMAIL="admin@isseg.local" ADMIN_PASSWORD="Admin123!Secure" pnpm --filter api seed
```

**Important** : la connexion à la base de données nécessite la variable d'environnement `DATABASE_URL`. Les identifiants par défaut sont `abdoul:azerty@localhost:5432/isseg`.

**Rôles seedés & comptes de test** : le seed crée aussi les 4 rôles applicatifs déjà
référencés par les guards `@Roles()` dans le code — `SCOLARITE`, `ENSEIGNANT`,
`CHEF_DEPARTEMENT`, `DGA_ETUDES` — avec des permissions minimales
(`MANAGE_DOSSIER_INSCRIPTION`, `READ_PEDAGOGIE`, `MANAGE_PEDAGOGIE`), plus un compte de
test par rôle : `{role}@isseg.local` (ex. `scolarite@isseg.local`), mot de passe temporaire
partagé `ChangeMe123!` — à faire tourner avant tout usage réel, ne jamais s'appuyer dessus
en dehors des environnements de dev/test. Le seed est idempotent (sûr à relancer).

### Build & qualité

```bash
# Builder tous les workspaces
pnpm build

# Linter tout le code
pnpm lint
```

### Environnement Docker

```bash
# Démarrer l'infrastructure (PostgreSQL + Redis)
docker-compose up -d postgres redis

# Démarrer tous les services
docker-compose up -d

# Voir les logs
docker-compose logs -f api
```

## Workflow Git

- **Toujours créer une nouvelle branche dédiée avant de commencer un chantier**, peu
  importe à quel point il paraît minime — hygiène git, changements purement
  documentaires, ajustements de config inclus. Il n'existe pas d'exception "trop
  mineur pour une branche".
- **Ne jamais committer directement sur `main`**, quelle que soit la taille du
  changement. Le nettoyage du `.gitignore` committé directement sur `main` le
  2026-08-19 était une exception ponctuelle explicitement demandée à ce moment-là —
  ce n'est **pas** un modèle à reproduire. Chaque changement, même trivial, passe
  par une branche (et une PR quand elle est ouverte).
- **Ne jamais mélanger frontend et backend sur une même branche**, même au sein
  d'un seul chantier logique. Si un chantier touche les deux (ex. "brancher le
  dashboard admin sur de vraies données"), le scinder en au moins deux branches :
  une pour le backend (nouveaux endpoints/modèles), une pour le frontend
  (consommant ces endpoints) — chacune avec ses propres tests, son propre diff,
  sa propre validation avant de passer à la suivante. Le frontend ne doit jamais
  dépendre d'un backend qui n'a pas encore été mergé sur `main` pour être
  testable — le backend d'abord, testé et mergé, seulement ensuite le frontend
  qui le consomme. Plus largement : **une branche = une fonctionnalité précise**,
  pas un ensemble de changements regroupés parce que "c'est le même thème". Si tu
  remarques que tu modifies des fichiers dans deux domaines différents (ex.
  `apps/api` *et* `apps/web`, ou deux modules métier distincts) sur la même
  branche, arrête-toi et propose une scission avant de continuer.
- **Tous les messages de commit et toute documentation écrite dans ce dépôt**
  (`CLAUDE.md`, `STATUT_MODULES.md`, `SETUP.md`, README, commentaires de code
  significatifs, descriptions de PR) **doivent être rédigés en français**. Le
  code lui-même (noms de variables, fonctions, modèles) reste en anglais par
  convention technique standard — cette règle concerne uniquement le texte
  destiné à être lu par des humains (documentation, commits, PR), pas les
  identifiants de code.

## Contraintes réseau

La plateforme doit rester utilisable dans des conditions de connexion réseau
dégradées ou instables, réalité courante en Guinée. Ces règles s'appliquent
**systématiquement**, pas seulement quand ça semble nécessaire :

- **Timeouts explicites et raisonnables sur tous les appels HTTP sortants**
  (inter-services, ex. `apps/worker` → `services/moodle-service`) — jamais
  d'attente indéfinie qui bloquerait une requête utilisateur.
- **Retry avec backoff sur les appels réseau non critiques en écriture**
  (ex. synchronisation Moodle), **jamais** sur les opérations qui doivent
  rester strictement une fois (paiements, validations de notes).
- **Pagination systématique sur tout endpoint de liste** — jamais de
  réponse qui charge un jeu de données complet d'un coup. Déjà en place
  sur `/utilisateurs`, `/dossiers-inscription` ; à respecter partout
  ailleurs (`PaginationDto`/`PaginationMetaDto` dans
  `src/common/dto/pagination.dto.ts`).
- **Réponses API aussi légères que possible** : ne renvoyer que les champs
  réellement utiles à l'écran qui consomme l'endpoint, éviter de
  sur-inclure des relations Prisma non nécessaires.
- **Côté frontend : états de chargement et d'erreur explicites sur chaque
  appel réseau** (déjà pratiqué sur `StatCard` avec
  ready/loading/error/coming-soon) — jamais d'écran figé sans retour
  visuel en cas de lenteur ou d'échec.
- **Éviter les dépendances à une connexion permanente quand une
  alternative asynchrone existe** (ex. la queue BullMQ déjà en place pour
  Moodle, plutôt qu'un appel synchrone bloquant).

## RBAC (contrôle d'accès basé sur les rôles)

La plateforme implémente un RBAC fin avec les rôles principaux suivants :

### Rôles administratifs
- **ADMIN / SUPER_ADMIN** : Accès système complet, gestion des utilisateurs/rôles/permissions, maintenance système
- **SCOLARITE** : Inscription des étudiants (intégration Parcoursup, gestion INE/matricule), validation documentaire, emplois du temps, délivrance des diplômes, traitement des congés académiques
- **COMPTABLE / RH** : Gestion financière, paiements en ligne, gestion du personnel

### Rôles académiques
- **ENSEIGNANT** : Conception de cours, saisie des notes pour les cours assignés, synchronisation LMS
- **CHEF_DEPARTEMENT** : Validation des notes (première étape), gestion des sections, supervision du programme pour son département
- **DGA_ETUDES** : Validation et publication des cours, validation des notes (étape Commission Pédagogique)
- **DIRECTEUR_GENERAL** : Validation finale des notes (étape Grand Conseil)

### Rôles Innovation & Support
- **DIRECTEUR_INNOVATION** : Gestion du centre d'innovation pédagogique, supervision des programmes de certification
- **RESPONSABLE_PUBLICATIONS** : Publications universitaires, attribution ISBN, comité de validation
- **RESPONSABLE_IT** : Gestion des requêtes de support informatique, suivi du matériel

### Rôles Étudiant & Parent
- **ETUDIANT** : Accès au profil, cours en ligne, remise de devoirs, consultation des notes, demandes de documents
- **PARENT** : Consultation de l'assiduité/des résultats de l'étudiant, contact avec l'administration

### Rôles Bibliothèque
- **BIBLIOTHECAIRE** : Gestion du catalogue, traitement des emprunts, gestion des abonnements
- **RESPONSABLE_NUMERISATION** : Numérisation des thèses et mémoires, gestion des métadonnées

## Architecture d'authentification

- **Access tokens** : JWT de courte durée (15 min par défaut), transmis dans l'en-tête `Authorization: Bearer <token>`
- **Refresh tokens** : longue durée (7 jours par défaut), stockés dans un cookie sécurisé HTTP-only
- **Rotation des tokens** : chaque refresh génère un nouveau refresh token et révoque l'ancien
- **Fonctionnalités de sécurité** : verrouillage de compte après échecs répétés, journal d'audit, révocation de tokens

## Workflows critiques

### Workflow de validation des notes à 5 étapes

Toutes les notes soumises par les enseignants doivent passer par cette chaîne de validation avant d'être finalisées :

1. **Section** (Enseignant/Chef de section)
   - Saisie initiale des notes par l'enseignant
   - Vérification et approbation au niveau section

2. **Comité de Programme**
   - Revue des notes pour la cohérence du programme
   - Validation inter-sections

3. **Conseil de Département** (Chef de Département)
   - Le chef de département revoit et valide les notes
   - Garantit l'alignement avec les standards du département

4. **Commission Pédagogique** (DGA Études)
   - Supervision et validation pédagogique
   - Assurance qualité sur l'ensemble des départements

5. **Grand Conseil** (Directeur Général)
   - Approbation institutionnelle finale
   - Publication officielle des notes

**Important** : chaque étape nécessite une approbation explicite et génère une trace d'audit. Les notes ne peuvent pas être modifiées une fois validées à une étape donnée sans passer par un workflow de correction formel.

### Intégration Parcoursup (Inscription)

La plateforme s'intègre avec le système national d'inscription français :

- **INE (Identifiant National Étudiant)** : les étudiants venant de Parcoursup ont un numéro INE
- **Matricule ISSEG** : les étudiants inscrits localement reçoivent un matricule ISSEG
- **Double suivi** : le système doit gérer les deux types d'identifiants et les faire correspondre correctement
- **Synchronisation des données** : les données d'inscription sont importées depuis Parcoursup pour les étudiants concernés

## Points d'intégration clés

### Scolarité ↔ Bibliothèque
Le module Bibliothèque doit appeler l'API Scolarité pour vérifier la régularité de l'étudiant avant d'autoriser un emprunt :
```
GET /api/v1/etudiants/:matricule/statut-regularite
```
Retourne : `{ isRegular: boolean, reason?: string, lastPaymentDate?: Date }`

### Pédagogie ↔ Moodle Service
Les opérations de synchronisation lourdes doivent être déléguées à `services/moodle-service` pour ne pas bloquer l'API principale.

### Scolarité ↔ Parcoursup
- Import des données d'inscription via l'intégration API Parcoursup
- Correspondance INE ↔ matricule ISSEG
- Gestion du double système d'identifiants pour le suivi des étudiants

### Départements ↔ Pédagogie
- Les chefs de département valident les notes de leurs sections
- Le statut du workflow de validation doit être suivi à chaque étape
- Trace d'audit requise pour toutes les actions de validation

### Innovation ↔ Services externes
- API ISBN pour les publications universitaires
- Intégration plateforme LMS (actuellement Google Workspace, migration vers Moodle prévue)
- Intégration système de billetterie pour le support informatique

## Fichiers de contexte par domaine

Pour travailler sur un module spécifique, se référer à ces fichiers de contexte :
- Scolarité & Inscription : `.claude/agent-scolarite.md`
- Pédagogie, Notes & LMS : `.claude/agent-pedagogie.md`
- Bibliothèque & Numérisation : `.claude/agent-bibliotheque.md`
- Départements & Validation : `.claude/agent-departements.md`
- Innovation & Publications : `.claude/agent-innovation.md`
- DevOps & Infrastructure : `.claude/agent-devops.md`

## Variables d'environnement

Copier `.env.example` vers `.env` et configurer :
- Identifiants de base de données (`DATABASE_URL`)
- Secrets JWT (générer avec : `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
- Identifiants admin pour le seed
- Origine CORS pour le frontend

## Documentation API

Quand l'API tourne en mode développement, Swagger UI est disponible sur :
- Interface : `http://localhost:3001/api/docs`
- JSON : `http://localhost:3001/api/docs-json`

## Règles métier & contraintes

### Régularité étudiante
Les étudiants doivent être "réguliers" (frais payés, aucun blocage administratif) pour :
- Emprunter des livres à la bibliothèque
- Accéder aux contenus de cours en ligne
- Remettre des devoirs
- Recevoir des relevés de notes ou certificats officiels

### Validation des notes
- Les notes ne peuvent pas sauter d'étape de validation
- Chaque étape de validation doit avoir une approbation explicite avec horodatage et identifiant de l'approbateur
- Les corrections de notes déjà validées nécessitent un workflow de correction formel
- Les notes finales (après le Grand Conseil) déclenchent la génération du relevé de notes

### Gestion documentaire
- Tous les documents officiels (attestations, diplômes) doivent avoir :
  - Un numéro de référence unique
  - Une trace de signature numérique
  - Une copie PDF archivée
  - Un journal d'audit de la délivrance

### Emprunts en bibliothèque

Les limites d'emprunt varient selon la catégorie d'emprunteur — il n'existe pas de règle unique. Source :
`agent-bibliotheque.md` §3.1 (entretien avec les parties prenantes), confirmée comme
version faisant autorité lors de l'audit de planification Bibliothèque (2026-08-19) —
ce tableau prévaut sur toute formulation simplifiée antérieure du type "3 emprunts / 14 jours".

| Catégorie d'emprunteur | Durée d'emprunt | Emprunts simultanés max | Renouvellement |
|---|---|---|---|
| Étudiant L1-L2 | 14 jours | 3 ouvrages | 1x (si aucune réservation en attente) |
| Étudiant L3-M2 | 21 jours | 5 ouvrages | 1x |
| Enseignant | 30 jours | 10 ouvrages | 2x |
| Personnel Admin | 14 jours | 3 ouvrages | 1x |

- Les retards déclenchent des notifications automatiques et des blocages de compte
- **Les emprunts à domicile (`POST /emprunts`) sont réservés aux `ENSEIGNANT` au
  lancement** — les étudiants sont limités à la consultation du catalogue sur
  place (`GET /ouvrages`) et aux réservations (`POST /reservations`), selon
  l'entretien avec le responsable Bibliothèque (Groupe 4, 2026-08-05). Appliqué
  via la valeur de configuration `BIBLIOTHEQUE_EMPRUNT_DOMICILE_TYPES_AUTORISES`
  (`empruntDomicileTypesAutorises` dans `configuration.ts`), pas une vérification
  codée en dur — étendre les emprunts à domicile aux étudiants est un changement
  de configuration (ajouter `ETUDIANT_L1_L2`/`ETUDIANT_L3_M2`), pas un nouveau
  chantier de code.

## Notes importantes

- **Gestionnaire de paquets** : ce projet utilise `pnpm@9.0.0` (imposé via le champ `packageManager`)
- **Emplacement Prisma** : le schéma et les migrations sont dans `apps/api/prisma/`
- **Code partagé** : toujours envisager si un code a sa place dans `packages/*` avant de l'ajouter à une app spécifique
- **Sécurité** : tous les endpoints utilisent la validation (class-validator), les DTOs doivent whitelister leurs propriétés
- **Gestion des erreurs** : le filtre d'exceptions global gère les erreurs Prisma et les exceptions HTTP
- **Isolation des données** : considérations multi-tenant pour les données propres à chaque département
- **Trace d'audit** : toutes les mutations (create/update/delete) doivent être journalisées dans la table AuditLog
