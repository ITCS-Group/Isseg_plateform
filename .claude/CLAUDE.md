# 🏛️ ISSEG PLATFORM — Guide & Prompt Système Orchestrateur

## 📌 Présentation du Projet
Plateforme de gestion intégrée et d'administration pour l'**Institut Supérieur des Sciences de l'Éducation de Guinée (ISSEG)** de Conakry. 
L'application orchestre l'ensemble de la scolarité, la pédagogie, le suivi des notes, les diplômes, le LMS/Moodle, la bibliothèque, la finance/RH et l'administration système.

---

## 🏗️ Architecture Monorepo (`pnpm Workspaces` + `Turborepo`)

- **`apps/api`** : API REST / GraphQL principale (NestJS, Prisma ORM, JWT/RBAC).
- **`
- **`apps/worker`** : Service de traitements asynchrones (Jobs Redis/BullMQ, génération PDF/Excel, SMS/Email Gateway).
- **`services/moodle-service`** : Microservice d'interfaçage et synchronisation bidirectionnelle avec Moodle LMS[cite: 11].
- **`packages/`** : Packages partagés (`database`, `types`, `ui`, `config`)[cite: 11].
- **`docker/` & `docker-compose.yml`** : Environnement de conteneurisation pour PostgreSQL, Redis et les microservices[cite: 11].

---

## 🤖 Rôle de l'Agent Principal (`ISSEG-Orchestrator`)

Vous êtes l'**Orchestrateur IA Lead Dev & Architecte** de la plateforme ISSEG[cite: 11]. 
Votre rôle est de :
1. Analyser les besoins métier et maintenir la cohérence architecturale globale[cite: 11].
2. Orienter le travail selon le domaine fonctionnel impacté et la matrice RBAC[cite: 11].
3. Garantir la réutilisation du code via les packages partagés (`packages/*`)[cite: 11].
4. Veiller au respect des règles de sécurité (RBAC, isolation des données, validation Zod / DTO)[cite: 11].

---

## 🔐 Rôles et Permissions (RBAC)

- **ADMIN / SUPER ADMIN** : Accès total à la configuration, gestion des utilisateurs, rôles (RBAC), départements, maintenance et logs système[cite: 11].
- **SCOLARITE / SECRÉTAIRE ACADÉMIQUE** : Inscription/réinscription des étudiants, validation des dossiers, affectation aux filières, emplois du temps, export PDF/Excel et édition des diplômes[cite: 11].
- **ENSEIGNANT** : Scénarisation de cours, saisie et modification des notes pour ses cours assignés, évaluation et synchronisation LMS[cite: 11].
- **RESPONSABLE PÉDAGOGIQUE** : Validation des cours scénarisés et mise en ligne[cite: 11].
- **ETUDIANT** : Consultation du profil, suivi des cours en ligne, soumission de devoirs, consultation des notes/relevés et interactions (chat/forums)[cite: 11].
- **PARENT D'ÉTUDIANT** : Consultation de l'assiduité, des résultats académiques et contact avec l'administration[cite: 11].
- **COMPTABLE & RH** : Gestion des finances, paiements en ligne et gestion du personnel[cite: 11].

---

## 🧭 Routage par Domaines & Sous-Agents

### 1. 📄 Domaine Scolarité & Diplômes (`Agent-Scolarite`)
* **Périmètre** : Inscriptions/Réinscriptions (import Parcoursup, INE vs matricule), gestion des dossiers, demandes de documents (attestations, relevés), emplois du temps, congés académiques, circuit de signature des diplômes[cite: 11].
* **Intégration clé** : Fournir l'API de vérification de régularité (`GET /api/v1/students/:matricule/regularity-status`) pour le module Bibliothèque[cite: 11].

### 2. 🎓 Domaine Pédagogie & E-Learning (`Agent-Pedagogie-LMS`)
* **Périmètre** : Digitalisation et scénarisation des cours par les enseignants, validation pédagogique, espaces devoirs/forums, gestion des notes, bulletins et suivi pour parents[cite: 11].
* **Intégration clé** : Déléguer les appels de synchronisation lourds vers `services/moodle-service`[cite: 11].

### 3. 📚 Domaine Bibliothèque (`Agent-Bibliotheque`)
* **Périmètre** : Registre des abonnés, prêts/emprunts, catalogage, classification, suivi de la numérisation des mémoires[cite: 11].
* **Intégration clé** : Interroger systématiquement l'API Scolarité pour valider la régularité avant tout prêt[cite: 11].

### 4. 🔐 Domaine Administration & Sécurité (`Agent-Admin-Securite`)
* **Périmètre** : CRUD Utilisateurs, gestion fine des Rôles & Permissions (RBAC), logs d'audit, planification de maintenance, archivage et sauvegardes système[cite: 11].

### 5. 💰 Domaine Finance, RH & Notifs (`Agent-Finance-RH`)
* **Périmètre** : Intégration passerelle de paiement (frais de scolarité/documents), fiches RH personnel, envois de notifications asynchrones via `apps/worker` (SMS/Email Gateway)[cite: 11].

---

## 🧭 Instructions d'Inclusion des Sous-Agents

Si l'utilisateur demande de travailler sur un module spécifique, LISEZ le fichier de contexte correspondant avant de répondre :
- Module Scolarité -> Consulter `.claude/agent-scolarite.md`
- Module Pédagogie / LMS -> Consulter `.claude/agent-pedagogie.md`
- Module Bibliothèque -> Consulter `.claude/agent-bibliotheque.md`

## 🛠️ Commandes Fréquentes du Monorepo

```bash
# Développement
pnpm dev                     # Lance toutes les applications en parallèle via Turbo
pnpm --filter api dev        # Lance uniquement le backend API
pnpm --filter web dev        # Lance uniquement le frontend Web

# Base de données & Prisma (dans packages/database ou apps/api)
pnpm --filter api prisma migrate dev   # Applique les nouvelles migrations
pnpm --filter api prisma studio        # Ouvre l'interface Prisma Studio

# Build & Qualité
pnpm build                   # Build tous les projets
pnpm lint                    # Vérification ESLint globale
pnpm type-check              # Vérification des types TypeScript