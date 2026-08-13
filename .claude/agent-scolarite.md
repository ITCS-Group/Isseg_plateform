# 📄 SOUS-AGENT : DOMAINE SCOLARITÉ & DIPLÔMES (`Agent-Scolarite`)

## 📌 Présentation du Domaine
Le sous-agent **Scolarité** régit la gestion administrative et le parcours académique des étudiants de l'ISSEG de Conakry[cite: 11]. Il couvre l'ensemble du cycle de vie étudiant : de la gestion des candidatures/inscriptions jusqu'à la délivrance certifiée des diplômes, en passant par le traitement des documents administratifs et le suivi des interruptions de scolarité[cite: 11].

---

## 👥 Acteurs & Matrice d'Accès (RBAC)

- **`SECRETAIRE_ACADEMIQUE`** : Saisie, vérification et validation des dossiers d'inscription ; édition des cartes et certificats ; gestion des emplois du temps et export des listes académiques[cite: 11].
- **`CHEF_DEPARTEMENT`** : Validation des candidatures/filières, instruction des demandes de congé académique, première signature électronique/validation des diplômes[cite: 11].
- **`DIRECTEUR_GENERAL`** : Validation finale des congés académiques et signature définitive des diplômes/attestations de réussite[cite: 11].
- **`ETUDIANT`** : Soumission des pièces justificatives, suivi de l'état d'inscription, demande de documents officiels, consultation du statut de régularité[cite: 11].

---

## 🗄️ Entités & Modèle de Données (Prisma / SGBD)

Les entités clés gérées dans `packages/database/prisma/schema.prisma` :

### 1. `Etudiant`
- `id` (UUID) / `matricule` (String, unique - Format ISSEG: `ISSEG-YYYY-XXXX`)
- `ine` (String, optional - Numéro Identifiant National Éducatif / Parcoursup)[cite: 11]
- `nom`, `prenom`, `dateNaissance`, `lieuNaissance`, `sexe`
- `statut` (`EN_ATTENTE_VALIDATION`, `REGULIER`, `SUSPENDU`, `ABANDON`, `DIPLOME`)
- `statutRégularité` (Boolean, default: `true` - Utilisé par la Bibliothèque)[cite: 11]
- `filiereId`, `niveauId`

### 2. `DemandeDocument`
- `id` (UUID), `etudiantId`
- `typeDocument` (`CERTIFICAT_SCOLARITE`, `RELEVE_NOTES`, `ATTESTATION_REUSSITE`, `DUPLICATA_CARTE`)
- `statut` (`EN_ATTENTE_PAIEMENT`, `EN_TRAITEMENT`, `DISPONIBLE`, `REJETE`)
- `fraisAssocies` (Decimal), `referencePaiement` (String, optional)[cite: 11]

### 3. `CongeAcademique`
- `id` (UUID), `etudiantId`, `anneeUniversitaire`
- `motif` (String), `piecesJustificatives` (String[])
- `statut` (`SOUMIS`, `AVIS_DEPARTEMENT_VALIDE`, `APPROUVE_DG`, `REFUSE`)[cite: 11]

### 4. `Diplome`
- `id` (UUID), `etudiantId`, `numeroSerie` (String, unique)
- `intituleFiliere`, `mention`
- `signatureChefDepartement` (Boolean / Timestamp)
- `signatureDirecteurGeneral` (Boolean / Timestamp)
- `hashAuthenticite` (String - pour vérification QR Code)

---

## 🔌 Contrats d'API REST (`apps/api`)

### Inscriptions & Étudiants
- `POST /api/v1/scolarite/inscriptions/import-parcoursup` : Import et réconciliation des dossiers via INE[cite: 11].
- `POST /api/v1/scolarite/etudiants` : Inscription manuelle / Génération du matricule ISSEG[cite: 11].
- `GET /api/v1/scolarite/etudiants` : Liste filtrée par filière, niveau et statut (Export PDF/Excel)[cite: 11].
- `GET /api/v1/scolarite/etudiants/:matricule` : Dossier administratif complet[cite: 11].

### Service Inter-Module (Régularité pour la Bibliothèque)
- `GET /api/v1/scolarite/etudiants/:matricule/regularity-status`
  - **Accès** : Restreint à l'API Key / Service Token du module `Bibliothèque`[cite: 11].
  - **Réponse** : `{ "matricule": "ISSEG-2026-0042", "estRegulier": true, "statut": "REGULIER" }`[cite: 11].

### Documents & Demandes Administrative
- `POST /api/v1/scolarite/documents/demande` : Soumission d'une demande par l'étudiant[cite: 11].
- `PATCH /api/v1/scolarite/documents/:id/statut` : Mises à jour par la secrétairerie académique[cite: 11].

### Diplômes & Congés
- `POST /api/v1/scolarite/conges/demander` : Dépôt d'une demande de congé académique[cite: 11].
- `POST /api/v1/scolarite/diplomes/generer` : Création du lot de diplômes pour la promotion[cite: 11].
- `POST /api/v1/scolarite/diplomes/:id/signer` : Endpoint de signature électronique (Chef Dép. / DG)[cite: 11].

---

## 🔄 Workflows Métier Clés

### Workflow 1 : Circuit d'Inscription & Attribution de Matricule

## 💻 Directives d'Implémentation Code

1. **Validation Zod / DTOs** : Tout DTO de création d'étudiant doit valider la structure de l'INE ou générer le matricule via un service dédié (`MatriculeGeneratorService`).
2. **Isolation des données** : Le contrôleur d'API de régularité ne doit renvoyer que le strict nécessaire (`estRegulier`, `statut`) sans exposer les données personnelles de l'étudiant à la bibliothèque[cite: 11].
3. **Traitements Asynchrones** : La génération des fichiers PDF lourds (certificats, relevés, diplômes) doit passer par l'envoi d'un job dans `apps/worker` via BullMQ[cite: 11].