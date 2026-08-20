# 🏛️ Plateforme ISSEG

> Système de gestion intégré pour l'Institut Supérieur des Sciences de l'Éducation de Guinée (ISSEG) de Conakry

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-9.0.0-orange)](https://pnpm.io/)

## 📋 Table des matières

- [À propos](#-à-propos)
- [Fonctionnalités](#-fonctionnalités)
- [Processus Métier Clés](#-processus-métier-clés)
- [Architecture](#-architecture)
- [Prérequis](#-prérequis)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Développement](#-développement)
- [Structure du projet](#-structure-du-projet)
- [Base de données](#-base-de-données)
- [API Documentation](#-api-documentation)
- [Sécurité](#-sécurité)
- [Déploiement](#-déploiement)
- [Contribution](#-contribution)

## 🎯 À propos

La plateforme ISSEG est un système de gestion universitaire complet conçu pour digitaliser et optimiser l'ensemble des processus académiques, administratifs et financiers de l'Institut Supérieur des Sciences de l'Éducation de Guinée.

Cette solution monorepo moderne intègre :
- **Gestion académique** : Inscriptions, scolarité, notes, diplômes
- **E-Learning** : Intégration Moodle LMS, cours en ligne, évaluations
- **Administration** : RBAC, gestion des utilisateurs, audit
- **Finance** : Frais de scolarité, paiements en ligne, transactions
- **Bibliothèque** : Catalogage, prêts, numérisation des mémoires
- **RH** : Gestion du personnel enseignant et administratif
- **Portail Parents** : Suivi académique et communication

## ✨ Fonctionnalités

### 👨‍🎓 Gestion des étudiants
- ✅ Inscription et réinscription en ligne
- ✅ Gestion des dossiers académiques
- ✅ Suivi du parcours universitaire
- ✅ Génération automatique de documents (attestations, relevés de notes)
- ✅ Validation des inscriptions par la scolarité

### 📚 Pédagogie et E-Learning
- ✅ Scénarisation de cours par les enseignants
- ✅ Intégration bidirectionnelle avec Moodle LMS
- ✅ Gestion des notes et évaluations
- ✅ Publication de cours en ligne
- ✅ Forums de discussion et devoirs
- ✅ Génération automatique de bulletins

### 🔐 Sécurité et RBAC
- ✅ Authentification JWT avec rotation des tokens
- ✅ Système de rôles et permissions granulaires
- ✅ Protection contre les attaques par force brute
- ✅ Audit complet des actions utilisateurs
- ✅ Rate limiting (100 requêtes/minute/IP)
- ✅ Stockage sécurisé des tokens de rafraîchissement

### 💰 Gestion financière
- ✅ Suivi des frais de scolarité
- ✅ Intégration passerelle de paiement
- ✅ Génération de reçus et factures
- ✅ Historique des transactions
- ✅ Rapports financiers

### 📖 Bibliothèque
- ✅ Catalogage des ouvrages
- ✅ Gestion des prêts et emprunts
- ✅ Vérification de régularité des étudiants
- ✅ Numérisation et archivage des mémoires

### 👥 Portail Parents
- ✅ Consultation des notes et résultats
- ✅ Suivi de l'assiduité
- ✅ Messagerie avec l'administration
- ✅ Accès au carnet de notes électronique

## 🔄 Processus Métier Clés

### Workflow de Validation des Notes (5 Étapes)

**Processus central** de la gestion pédagogique. Toutes les notes doivent passer par ces 5 étapes de validation avant publication :

```
ENSEIGNANT → SECTION → COMITÉ PROGRAMME → CONSEIL DÉPARTEMENT → COMMISSION PÉDA → GRAND CONSEIL
  (Saisie)    (Étape 1)     (Étape 2)          (Étape 3)           (Étape 4)      (Étape 5)
```

#### Détail des étapes

1. **Section** (Chef de Section)
   - Saisie initiale des notes par l'enseignant
   - Calcul automatique : Note finale = (CC × 0,3) + (TP × 0,2) + (Examen × 0,5)
   - Première validation au niveau de la section

2. **Comité de Programme** (Responsable de Programme)
   - Revue des notes d'un programme complet (ex: Licence Sciences de l'Éducation L3)
   - Vérification de cohérence inter-modules
   - Détection d'anomalies statistiques

3. **Conseil de Département** (Chef de Département)
   - Validation au niveau du département
   - Décisions sur les cas particuliers (rattrapages, dispenses)
   - Génération des PV de délibération

4. **Commission Pédagogique** (DGA Études)
   - Supervision pédagogique inter-départements
   - Harmonisation des pratiques de notation
   - Droit de veto sur toutes les notes

5. **Grand Conseil** (Directeur Général)
   - Validation finale et publication officielle
   - Signature des procès-verbaux
   - **Notes immutables après cette étape** (amendement formel requis pour toute correction)

### Les 4 Départements Académiques

| Code | Département | Domaines d'enseignement |
|------|-------------|------------------------|
| **SEDU** | Sciences de l'Éducation | Pédagogie, psychologie de l'éducation, administration scolaire |
| **DID** | Didactique | Méthodologies d'enseignement, formation des enseignants, didactiques disciplinaires |
| **SDL** | Sciences du Langage | Linguistique appliquée, français langue étrangère, langues nationales |
| **SSOC** | Sciences Sociales | Sociologie de l'éducation, anthropologie, sciences politiques |

Chaque département :
- Est dirigé par un **Chef de Département** (rôle CHEF_DEPARTEMENT)
- Gère plusieurs **sections** pédagogiques (par niveau : L1, L2, L3, M1, M2)
- Valide les notes à l'étape 3 du workflow
- Supervise les enseignants et les programmes de formation

### Intégration Parcoursup

La plateforme ISSEG s'intègre avec le système national **Parcoursup** pour la gestion des inscriptions :

#### Double Système d'Identification

- **INE (Identifiant National Étudiant)** :
  - Fourni par Parcoursup pour les étudiants du système guinéenne
  - Format : 11 caractères (10 chiffres + 1 lettre de contrôle)
  - Permanent tout au long du parcours universitaire

- **Matricule ISSEG** :
  - Attribué localement : `ISSEG-YYYY-NNNN`
  - Exemple : `ISSEG-2024-0123`
  - Mapping automatique INE ↔ Matricule ISSEG

#### Processus d'Import
1. Import CSV/API depuis Parcoursup
2. Validation des informations (INE, état civil, filière)
3. Création automatique du dossier étudiant
4. Génération du matricule ISSEG
5. Notification à l'étudiant + activation des accès LMS

### Module Innovation & Publications

#### Publications Universitaires
- Attribution de numéros **ISBN** pour les publications institutionnelles
- Comité de validation des publications
- Gestion du catalogue des publications de l'ISSEG
- Suivi des droits d'auteur et de la diffusion

#### Centre d'Innovation Pédagogique
- Gestion des **programmes de certification** (formation continue)
- Plateforme LMS (actuellement Google Workspace, migration Moodle en cours)
- Développement de contenus pédagogiques innovants
- Formation des enseignants aux nouvelles technologies

#### Support Informatique
- Gestion des demandes de support (ticketing)
- Suivi des équipements (actuellement 36 ordinateurs pour 200+ étudiants)
- Équipe de 12 personnes (3 permanents, 9 prestataires)
- Maintenance du parc informatique

### Organisation de la Bibliothèque

#### 3 Sections Principales

1. **Section Ouvrages Généraux** (~5 000 ouvrages)
   - Livres de référence et manuels universitaires
   - Classification Décimale de Dewey (CDD)
   - Système de cote : `XXX.X-ABC` (Dewey + 3 lettres auteur)

2. **Section Périodiques** (~200 titres)
   - Revues scientifiques spécialisées
   - Magazines éducatifs
   - Archives des publications

3. **Section Numérique** (~1 500 documents)
   - Thèses et mémoires numérisés
   - E-books et ressources en ligne
   - Accès aux bases de données académiques

#### Règles de Prêt

| Catégorie | Durée | Maximum simultané | Renouvellement |
|-----------|-------|-------------------|----------------|
| Étudiant L1-L2 | 14 jours | 3 ouvrages | 1 fois |
| Étudiant L3-M2 | 21 jours | 5 ouvrages | 1 fois |
| Enseignant | 30 jours | 10 ouvrages | 2 fois |

**Importante** : Vérification automatique de régularité (API Scolarité) avant tout prêt :
- Frais de scolarité à jour
- Aucun blocage administratif
- Pas d'emprunt en retard

#### Numérisation des Mémoires

Processus de digitalisation :
1. Réception du mémoire/thèse validé
2. Numérisation haute résolution (PDF/A)
3. OCR (reconnaissance optique)
4. Extraction métadonnées (titre, auteur, mots-clés, résumé)
5. Upload stockage sécurisé
6. Indexation dans le catalogue
7. Mise en ligne (si autorisation de l'étudiant)

## 🏗️ Architecture

### Stack Technique

**Backend**
- **Framework** : NestJS 10 (Node.js/TypeScript)
- **ORM** : Prisma 5
- **Base de données** : PostgreSQL 16
- **Cache/Jobs** : Redis 7 + BullMQ
- **Authentification** : JWT (Passport)
- **Validation** : class-validator, class-transformer
- **Documentation** : Swagger/OpenAPI

**Frontend**
- **Framework** : Next.js 14 (App Router)
- **UI Library** : React 18
- **Styling** : TailwindCSS
- **State Management** : Zustand
- **Data Fetching** : TanStack Query (React Query)
- **HTTP Client** : Axios
- **Icons** : Lucide React

**Infrastructure**
- **Containerisation** : Docker & Docker Compose
- **Monorepo** : pnpm Workspaces + Turborepo
- **CI/CD** : À définir (GitHub Actions recommandé)

### Architecture Monorepo

```
isseg-platform/
├── apps/
│   ├── api/              # API REST NestJS
│   ├── web/              # Application web Next.js
│   └── worker/           # Worker asynchrone (BullMQ)
├── services/
│   └── moodle-service/   # Microservice de synchronisation Moodle
├── packages/
│   ├── shared/           # Types, DTOs, utilitaires partagés
│   ├── ui/               # Composants React réutilisables
│   └── config/           # Configurations communes
└── docker/               # Dockerfiles
```

### Flux d'authentification

```
1. Client → POST /api/v1/auth/login
   ↓
2. API valide credentials + génère accessToken (JWT 15min) + refreshToken (7j)
   ↓
3. refreshToken stocké en DB (hashé) + envoyé via cookie HTTP-only
   ↓
4. Client utilise accessToken dans header Authorization: Bearer <token>
   ↓
5. Token expiré → POST /api/v1/auth/refresh avec cookie
   ↓
6. Rotation : nouveau refreshToken généré, ancien révoqué
```

## 🛠️ Prérequis

- **Node.js** : >= 18.0.0
- **pnpm** : 9.0.0 (gestionnaire de paquets)
- **PostgreSQL** : >= 16
- **Redis** : >= 7
- **Docker & Docker Compose** (optionnel mais recommandé)

## 📦 Installation

### 1. Cloner le repository

```bash
git clone https://github.com/ITCS-Group/Isseg_plateform.git
cd Isseg_plateform
```

### 2. Installer les dépendances

```bash
# Installer pnpm globalement si nécessaire
npm install -g pnpm@9.0.0

# Installer toutes les dépendances du monorepo
pnpm install
```

### 3. Configuration de l'environnement

```bash
# Copier le fichier d'exemple
cp .env.example .env

# Éditer le fichier .env avec vos valeurs
nano .env
```

### 4. Démarrer l'infrastructure (Docker)

```bash
# Démarrer PostgreSQL + Redis
docker-compose up -d postgres redis

# Ou démarrer tous les services
docker-compose up -d
```

### 5. Initialiser la base de données

```bash
# Appliquer les migrations Prisma
DATABASE_URL="postgresql://abdoul:azerty@localhost:5432/isseg?schema=public" \
  pnpm --filter api prisma migrate dev

# Générer le client Prisma
DATABASE_URL="postgresql://abdoul:azerty@localhost:5432/isseg?schema=public" \
  pnpm --filter api prisma generate

# Seed initial (créer l'utilisateur admin)
DATABASE_URL="postgresql://abdoul:azerty@localhost:5432/isseg?schema=public" \
  ADMIN_EMAIL="admin@isseg.local" \
  ADMIN_PASSWORD="Admin123!Secure" \
  ADMIN_NOM="Administrateur" \
  ADMIN_PRENOM="Système" \
  pnpm --filter api seed
```

Le seed crée aussi 4 rôles applicatifs — `SCOLARITE`, `ENSEIGNANT`, `CHEF_DEPARTEMENT`,
`DGA_ETUDES` — avec des permissions minimales, ainsi qu'un compte de test
par rôle :

| Email | Rôle | Mot de passe |
|---|---|---|
| `scolarite@isseg.local` | SCOLARITE | `ChangeMe123!` |
| `enseignant@isseg.local` | ENSEIGNANT | `ChangeMe123!` |
| `chef_departement@isseg.local` | CHEF_DEPARTEMENT | `ChangeMe123!` |
| `dga_etudes@isseg.local` | DGA_ETUDES | `ChangeMe123!` |

⚠️ Mot de passe temporaire **partagé** — à faire tourner avant tout usage réel, ne
jamais laisser ces comptes actifs avec ce mot de passe sur un environnement exposé.
Le seed est idempotent (relançable sans dupliquer).

## ⚙️ Configuration

### Variables d'environnement

Créez un fichier `.env` à la racine du projet :

```env
# Environnement
NODE_ENV=development
PORT=3001

# Base de données PostgreSQL
DATABASE_URL="postgresql://abdoul:azerty@localhost:5432/isseg?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# CORS (URL du frontend)
CORS_ORIGIN=http://localhost:3000

# JWT - Secrets (GÉNÉRER DES VALEURS ALÉATOIRES EN PRODUCTION !)
# Générer avec : node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=VOTRE_SECRET_ACCESS_TOKEN_64_CARACTERES_MINIMUM
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=VOTRE_SECRET_REFRESH_TOKEN_64_CARACTERES_MINIMUM
JWT_REFRESH_EXPIRES_IN=7d

# Cookie pour le refresh token
COOKIE_NAME=refreshToken

# Utilisateur administrateur initial (seed)
ADMIN_EMAIL=admin@isseg.local
ADMIN_PASSWORD=MotDePasseSecurise123!
ADMIN_NOM=Administrateur
ADMIN_PRENOM=Système
```

### Générer des secrets JWT sécurisés

```bash
# Access token secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Refresh token secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 🚀 Développement

### Démarrer tous les services

```bash
# Lancer API + Web + Worker en parallèle
pnpm dev
```

### Démarrer des services spécifiques

```bash
# API uniquement (port 3001)
pnpm --filter api dev

# Frontend uniquement (port 3000)
pnpm --filter web dev

# Worker uniquement
pnpm --filter worker dev

# Service Moodle
pnpm --filter moodle-service dev
```

### Commandes de base de données

```bash
# Créer une nouvelle migration
pnpm --filter api prisma migrate dev --name ma_migration

# Appliquer les migrations
pnpm --filter api prisma migrate deploy

# Réinitialiser la base (⚠️ DANGER - efface toutes les données)
pnpm --filter api prisma migrate reset

# Ouvrir Prisma Studio (interface graphique)
DATABASE_URL="postgresql://abdoul:azerty@localhost:5432/isseg?schema=public" \
  pnpm --filter api prisma studio
```

### Build de production

```bash
# Build tous les workspaces
pnpm build

# Build spécifique
pnpm --filter api build
pnpm --filter web build
```

### Linting et formatage

```bash
# Vérifier le code
pnpm lint

# Formater le code
pnpm format
```

## 📁 Structure du projet

### `apps/api` - Backend NestJS

```
apps/api/
├── prisma/
│   ├── schema.prisma         # Schéma de la base de données
│   ├── migrations/           # Migrations SQL générées
│   └── seed.ts               # Script de seed initial
├── src/
│   ├── auth/                 # Module d'authentification
│   │   ├── guards/           # Guards JWT, Roles, Permissions
│   │   ├── strategies/       # Stratégies Passport (JWT, Local)
│   │   ├── dto/              # DTOs de login, refresh, etc.
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.module.ts
│   ├── identity/             # Gestion utilisateurs, rôles, permissions
│   │   ├── users/
│   │   ├── roles/
│   │   └── permissions/
│   ├── common/               # Ressources partagées
│   │   ├── decorators/       # @Public(), @Roles(), @Permissions()
│   │   ├── filters/          # Filtres d'exceptions globaux
│   │   └── dto/              # DTOs communs (pagination, etc.)
│   ├── config/               # Configuration centralisée
│   ├── database/
│   │   └── prisma/           # Module et service Prisma
│   ├── app.module.ts         # Module racine
│   └── main.ts               # Point d'entrée (bootstrap)
└── package.json
```

### `apps/web` - Frontend Next.js

```
apps/web/
├── app/                      # App Router Next.js 14
│   ├── (auth)/               # Routes d'authentification
│   ├── (dashboard)/          # Routes protégées
│   ├── layout.tsx
│   └── page.tsx
├── components/               # Composants React
├── lib/                      # Utilitaires, API client
├── public/                   # Assets statiques
├── styles/                   # Styles globaux
└── package.json
```

### `apps/worker` - Worker asynchrone

```
apps/worker/
├── src/
│   ├── jobs/                 # Définition des jobs
│   │   ├── email.job.ts
│   │   ├── pdf.job.ts
│   │   └── sms.job.ts
│   ├── processors/           # Processeurs de jobs
│   └── index.ts
└── package.json
```

### `services/moodle-service` - Microservice Moodle

```
services/moodle-service/
├── src/
│   ├── api/                  # Client API Moodle
│   ├── sync/                 # Logique de synchronisation
│   └── index.ts
└── package.json
```

## 🗄️ Base de données

### Modèle de données principal

**Identité et utilisateurs**
- `Utilisateur` : Comptes utilisateurs
- `Role` : Rôles système (ADMIN, ETUDIANT, ENSEIGNANT, etc.)
- `Permission` : Permissions granulaires
- `UtilisateurRole` : Table de liaison many-to-many
- `RolePermission` : Table de liaison many-to-many
- `RefreshToken` : Tokens de rafraîchissement (hashés)
- `AuditLog` : Journal d'audit des actions

**Personnel et structure**
- `Personnel` : Données du personnel
- `Departement` : Départements académiques
- `Enseignant` : Profil enseignant (étend Personnel)
- `ResponsablePedagogique` : Responsables pédagogiques

**Étudiants et scolarité**
- `Etudiant` : Profils étudiants
- `Parent` : Parents d'étudiants
- `ParentEtudiant` : Liaison parent-étudiant
- `Filiere` : Filières d'études
- `NiveauEtude` : Niveaux (L1, L2, L3, M1, M2)
- `DossierInscription` : Dossiers d'inscription
- `InscriptionAnnuelle` : Inscriptions par année académique

**Finance**
- `FraisScolarite` : Frais de scolarité
- `Transaction` : Transactions de paiement
- `TypeDocument` : Types de documents (attestation, relevé, etc.)
- `DocumentEmis` : Documents émis aux étudiants

### Schéma de base

```prisma
// Exemple : Utilisateur et RBAC
model Utilisateur {
  id             String    @id @default(uuid())
  nom            String
  prenom         String
  email          String    @unique
  motDePasseHash String
  estActif       Boolean   @default(true)
  loginAttempts  Int       @default(0)
  lockedUntil    DateTime?
  lastLoginAt    DateTime?

  roles         UtilisateurRole[]
  refreshTokens RefreshToken[]
  auditLogs     AuditLog[]
}

model Role {
  id      String @id @default(uuid())
  nomRole String @unique

  utilisateurs UtilisateurRole[]
  permissions  RolePermission[]
}
```

## 📚 API Documentation

### Endpoints d'authentification

**POST** `/api/v1/auth/login`
```json
{
  "email": "admin@isseg.local",
  "password": "Admin123!Secure"
}
```
Réponse :
```json
{
  "accessToken": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "admin@isseg.local",
    "nom": "Administrateur",
    "prenom": "Système",
    "roles": ["ADMIN"]
  }
}
```
+ Cookie `refreshToken` (HTTP-only, Secure, SameSite)

**POST** `/api/v1/auth/refresh`
- Utilise le cookie `refreshToken`
- Retourne un nouveau `accessToken` et un nouveau `refreshToken`

**POST** `/api/v1/auth/logout`
- Révoque le refresh token actuel
- Supprime le cookie

**GET** `/api/v1/auth/me`
- Requiert : `Authorization: Bearer <accessToken>`
- Retourne les informations de l'utilisateur connecté

### Documentation Swagger

En mode développement, l'API expose une documentation Swagger interactive :

- **Interface Swagger UI** : http://localhost:3001/api/docs
- **Spécification OpenAPI JSON** : http://localhost:3001/api/docs-json

#### Utiliser Swagger pour tester l'API

1. Ouvrez http://localhost:3001/api/docs
2. Appelez `POST /api/v1/auth/login` avec vos identifiants
3. Copiez le `accessToken` de la réponse
4. Cliquez sur le bouton **Authorize** 🔒 en haut de la page
5. Collez : `Bearer <accessToken>`
6. Toutes les routes protégées seront maintenant authentifiées

### Rate Limiting

L'API applique un rate limiting global :
- **Limite** : 100 requêtes par minute par adresse IP
- **En-têtes de réponse** :
  - `X-RateLimit-Limit`: Limite totale
  - `X-RateLimit-Remaining`: Requêtes restantes
  - `X-RateLimit-Reset`: Timestamp de réinitialisation

Si dépassé, l'API retourne :
```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

## 🔒 Sécurité

### Authentification et autorisation

**Architecture JWT à double token**
1. **Access Token** : JWT court (15 minutes)
   - Stocké en mémoire côté client
   - Passé dans `Authorization: Bearer <token>`
   - Contient : `userId`, `email`, `roles`

2. **Refresh Token** : JWT long (7 jours)
   - Stocké en cookie HTTP-only, Secure, SameSite
   - Hashé (bcrypt) avant stockage en base
   - Rotation automatique à chaque refresh

**Système RBAC (Role-Based Access Control)**
- Rôles assignables à chaque utilisateur
- Permissions granulaires par rôle
- Guards NestJS :
  - `JwtAuthGuard` : Vérifie le token JWT
  - `RolesGuard` : Vérifie les rôles requis
  - `PermissionsGuard` : Vérifie les permissions requises

**Exemple d'utilisation des guards**
```typescript
@Controller('users')
export class UsersController {

  @Get()
  @Roles('ADMIN', 'SCOLARITE')  // Accessible aux ADMIN et SCOLARITE
  async findAll() {
    // ...
  }

  @Delete(':id')
  @Permissions('users:delete')  // Nécessite la permission spécifique
  async delete(@Param('id') id: string) {
    // ...
  }

  @Post('public-endpoint')
  @Public()  // Route publique (pas d'authentification requise)
  async publicRoute() {
    // ...
  }
}
```

### Protection contre les attaques

**Force brute (Brute Force)**
- Compteur de tentatives de connexion échouées
- Verrouillage du compte après 5 tentatives
- Déverrouillage automatique après 15 minutes
- Logs d'audit de toutes les tentatives

**Injection SQL**
- Utilisation de Prisma ORM (requêtes paramétrées)
- Aucune construction de requête SQL manuelle

**XSS (Cross-Site Scripting)**
- Validation stricte des entrées (class-validator)
- Sanitisation automatique par Next.js côté frontend
- Headers de sécurité (helmet.js)

**CSRF (Cross-Site Request Forgery)**
- Cookies SameSite=Strict
- Validation de l'origine CORS

**Headers de sécurité (Helmet.js)**
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000
X-DNS-Prefetch-Control: off
```

### Audit et traçabilité

**Journal d'audit complet**
- Toutes les connexions (réussies et échouées)
- Changements de mots de passe
- Révocations de tokens
- Verrouillage/déverrouillage de comptes
- Actions sensibles

**Informations enregistrées**
- Utilisateur concerné
- Action effectuée
- Adresse IP
- User-Agent
- Timestamp
- Détails supplémentaires (JSON)

## 🚢 Déploiement

### Déploiement avec Docker

```bash
# Production : construire et démarrer
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Voir les logs
docker-compose logs -f

# Arrêter les services
docker-compose down
```

### Variables d'environnement production

⚠️ **IMPORTANT** : En production, générez de nouveaux secrets :

```bash
# JWT Access Secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# JWT Refresh Secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Configuration minimale pour la production :
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/isseg
JWT_SECRET=<secret_généré_64_chars>
JWT_REFRESH_SECRET=<secret_généré_64_chars>
CORS_ORIGIN=https://votre-domaine.com
```

### Migration de base de données en production

```bash
# Appliquer les migrations (sans prompt)
DATABASE_URL="postgresql://..." pnpm --filter api prisma migrate deploy
```

## 🤝 Contribution

### Workflow Git

1. **Créer une branche** depuis `main`
```bash
git checkout -b feature/ma-fonctionnalite
# ou
git checkout -b fix/correction-bug
```

2. **Développer et commiter**
```bash
git add .
git commit -m "feat: ajouter la fonctionnalité X"
```

3. **Pousser et créer une Pull Request**
```bash
git push origin feature/ma-fonctionnalite
```

### Convention de commit (Conventional Commits)

- `feat:` Nouvelle fonctionnalité
- `fix:` Correction de bug
- `docs:` Documentation
- `style:` Formatage, points-virgules manquants, etc.
- `refactor:` Refactoring de code
- `test:` Ajout de tests
- `chore:` Maintenance, dépendances

**Exemples** :
```
feat(auth): implémenter la rotation des refresh tokens
fix(api): corriger la validation des DTOs d'inscription
docs(readme): ajouter les instructions de déploiement
refactor(users): extraire la logique métier dans un service
```

### Standards de code

- **TypeScript strict** : Typage fort, pas de `any`
- **ESLint** : Respecter les règles configurées
- **Prettier** : Formatage automatique
- **Tests** : Ajouter des tests unitaires pour la logique métier

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 👥 Support et Contact

- **Email** : support@isseg.edu
- **Documentation** : [Wiki du projet](https://github.com/ITCS-Group/Isseg_plateform/wiki)
- **Issues** : [GitHub Issues](https://github.com/ITCS-Group/Isseg_plateform/issues)

---

Développé avec ❤️ par l'équipe ITCS Group pour l'ISSEG de Conakry, Guinée.
