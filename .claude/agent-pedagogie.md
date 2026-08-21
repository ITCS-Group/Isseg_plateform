# Agent Pédagogie — Module Pédagogique, Notes et LMS

Ce fichier fournit un contexte détaillé pour le module **Pédagogie** de la plateforme ISSEG.

## Périmètre Fonctionnel

Le module Pédagogie couvre :

1. **Workflow de Validation des Notes (5 Stages)**
2. **Gestion des Cours et Programmes**
3. **Intégration LMS/Moodle**
4. **Bulletins et Relevés de Notes**
5. **Gestion des Départements et Sections**
6. **Portail Parent (Suivi Étudiant)**

---

## 1. Workflow de Validation des Notes (5 Stages)

**CRITIQUE**: C'est le workflow le plus important du module pédagogique. Toutes les notes doivent passer par ces 5 étapes avant publication finale.

### 1.1 Vue d'Ensemble

```
ENSEIGNANT → SECTION → COMITÉ PROGRAMME → CONSEIL DÉPARTEMENT → COMMISSION PÉDA → GRAND CONSEIL
  (Saisie)     (Stage 1)     (Stage 2)           (Stage 3)           (Stage 4)      (Stage 5)
```

### 1.2 Détail des Stages

#### Stage 1: Section (Enseignant / Chef de Section)

**Rôle**: ENSEIGNANT, CHEF_SECTION
**Actions**:
- Saisie initiale des notes par l'enseignant
- Vérification de cohérence (notes entre 0 et 20)
- Calcul automatique des moyennes (CC, TP, Examen final)
- Première validation au niveau de la section

**Règles métier**:
- Note finale = (CC × 0.3) + (TP × 0.2) + (Examen × 0.5)
- Les notes peuvent être modifiées jusqu'à validation
- Notification automatique au responsable de section

```typescript
POST /api/v1/pedagogie/notes/saisir
{
  enseignantId: "uuid",
  coursId: "uuid",
  evaluations: [
    { etudiantId: "uuid", noteCC: 12, noteTP: 14, noteExamen: 15 }
  ]
}

// Calcul automatique : noteFin ale = (12*0.3 + 14*0.2 + 15*0.5) = 13.9
```

#### Stage 2: Comité de Programme

**Rôle**: RESPONSABLE_PROGRAMME
**Actions**:
- Revue de toutes les notes d'un programme (ex: Licence Sciences de l'Éducation L3)
- Vérification de cohérence inter-modules
- Détection d'anomalies statistiques (taux d'échec anormal, moyennes aberrantes)

**Règles métier**:
- Si taux d'échec > 50% → Investigation requise
- Comparaison avec historique des années précédentes
- Validation globale du programme

#### Stage 3: Conseil de Département (Chef de Département)

**Rôle**: CHEF_DEPARTEMENT
**Actions**:
- Validation au niveau du département (ex: Sciences de l'Éducation)
- Vue d'ensemble sur tous les programmes du département
- Décisions sur les cas particuliers (rattrapages, dispenses)

**Départements ISSEG**:
1. Sciences de l'Éducation (SEDU)
2. Didactique (DID)
3. Sciences du Langage (SDL)
4. Sciences Sociales (SSOC)

**Règles métier**:
- Le chef de département peut demander des corrections
- Génération automatique des PV de délibération
- Notification aux enseignants en cas de rejet

#### Stage 4: Commission Pédagogique

**Rôle**: DGA_ETUDES
**Actions**:
- Supervision pédagogique inter-départements
- Harmonisation des pratiques de notation
- Validation des cas exceptionnels

**Règles métier**:
- Droit de veto sur toutes les notes
- Peut demander une révision à n'importe quel stage précédent
- Génère les recommandations pédagogiques institutionnelles

#### Stage 5: Grand Conseil (Directeur Général)

**Rôle**: DIRECTEUR_GENERAL
**Actions**:
- Validation finale et publication officielle
- Signature des procès-verbaux
- Autorisation de publication des relevés de notes

**Règles métier**:
- Une fois validé au Grand Conseil, les notes sont **IMMUTABLES**
- Toute correction ultérieure nécessite un workflow d'amendement formel
- Publication automatique sur le portail étudiant
- Génération des bulletins PDF signés

### 1.3 États du Workflow

```typescript
enum StatutValidationNote {
  BROUILLON              // Enseignant en cours de saisie
  ATTENTE_SECTION        // Stage 1
  ATTENTE_COMITE_PROG    // Stage 2
  ATTENTE_CONSEIL_DEPT   // Stage 3
  ATTENTE_COMMISSION_PEDA // Stage 4
  ATTENTE_GRAND_CONSEIL  // Stage 5
  VALIDE_PUBLIE          // Final - Immutable
  REJETE                 // Rejet à un stage (avec motif)
}
```

### 1.4 API de Validation

```typescript
// Valider à un stage donné
POST /api/v1/pedagogie/notes/valider
{
  cohorteNotesId: "uuid",  // Ensemble de notes (cours + promo)
  stageActuel: "ATTENTE_CONSEIL_DEPT",
  decision: "APPROUVE" | "REJETE",
  motifRejet?: string,
  commentaires?: string
}

// Traçabilité complète
Response:
{
  success: true,
  nouvelleEtape: "ATTENTE_COMMISSION_PEDA",
  auditLog: {
    validePar: "Chef Département - Dr. CAMARA",
    dateValidation: "2024-12-15T14:30:00Z",
    stageValide: "CONSEIL_DEPARTEMENT"
  }
}
```

### 1.5 Workflow d'Amendement (Post-Publication)

Si une erreur est découverte **après** la validation au Grand Conseil :

```
1. Enseignant ou Chef Dept identifie l'erreur
2. Demande d'amendement formelle (avec justification)
3. Approbation du Directeur Général requise
4. Correction dans le système
5. Génération d'un nouvel bulletin avec mention "RECTIFICATIF"
6. Archivage de l'ancien et du nouveau bulletin
7. Notification de l'étudiant
```

---

## 2. Gestion des Cours et Programmes

### 2.1 Structure Hiérarchique

```
Département
  └── Programme (ex: Licence Sciences de l'Éducation)
       └── Niveau (L1, L2, L3)
            └── Semestre (S1, S2)
                 └── Unité d'Enseignement (UE)
                      └── Cours / Module
```

### 2.2 Entités Prisma

```prisma
model Departement {
  id          String @id @default(cuid())
  code        String @unique  // SEDU, DID, SDL, SSOC
  nom         String
  chefId      String  // Utilisateur avec rôle CHEF_DEPARTEMENT

  programmes  Programme[]
  sections    Section[]
}

model Programme {
  id            String @id @default(cuid())
  intitule      String  // "Licence Sciences de l'Éducation"
  departementId String
  departement   Departement @relation(...)

  niveaux       Niveau[]
}

model Cours {
  id              String @id @default(cuid())
  code            String @unique  // SEDU-L3-S1-101
  titre           String  // ⚠️ le vrai modèle CoursScenarise utilise `titre`, pas `intitule` — cf. schema.prisma
  credits         Int     // Crédits ECTS
  coefficientCC   Decimal // 0.3
  coefficientTP   Decimal // 0.2
  coefficientExam Decimal // 0.5

  enseignantId    String
  enseignant      Utilisateur @relation(...)

  evaluations     Evaluation[]
}

model Evaluation {
  id          String @id @default(cuid())
  coursId     String
  etudiantId  String

  noteCC      Decimal?
  noteTP      Decimal?
  noteExamen  Decimal?
  noteFinale  Decimal  // Calculée automatiquement

  // Workflow de validation
  statut      StatutValidationNote
  validations ValidationNote[]  // Historique des validations

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ValidationNote {
  id            String @id @default(cuid())
  evaluationId  String
  stage         String  // SECTION, COMITE_PROG, etc.
  decision      String  // APPROUVE, REJETE
  validePar     String  // ID utilisateur
  dateValidation DateTime @default(now())
  commentaires  String?
}
```

### 2.3 Permissions RBAC pour les Notes

```typescript
const NOTES_PERMISSIONS = {
  ENSEIGNANT: [
    'notes.create',       // Saisir les notes
    'notes.update',       // Modifier (si non validées)
    'notes.read-own',     // Voir ses propres cours
  ],

  CHEF_SECTION: [
    'notes.validate-section',
    'notes.read-section',
  ],

  RESPONSABLE_PROGRAMME: [
    'notes.validate-programme',
    'notes.read-programme',
  ],

  CHEF_DEPARTEMENT: [
    'notes.validate-departement',
    'notes.read-departement',
    'notes.request-correction',
  ],

  DGA_ETUDES: [
    'notes.validate-commission',
    'notes.read-all',
    'notes.veto',
  ],

  DIRECTEUR_GENERAL: [
    'notes.validate-final',
    'notes.publish',
    'notes.approve-amendment',
  ],
};
```

---

## 3. Intégration LMS/Moodle

### 3.1 Architecture d'Intégration

```
apps/api (ISSEG Platform)
    ↓ (1) Trigger sync
services/moodle-service (Microservice)
    ↓ (2) API calls
Moodle LMS (External)
```

**Important**: Les opérations lourdes (import de cours, sync des utilisateurs) doivent passer par `services/moodle-service` pour éviter de bloquer l'API principale.

### 3.2 Flux de Synchronisation

#### Synchronisation des Utilisateurs

```
1. Étudiant inscrit dans ISSEG Platform
2. Event déclenché → Queue BullMQ
3. Worker envoie requête à services/moodle-service
4. Moodle-service crée l'utilisateur dans Moodle
5. Retour du Moodle user ID
6. Stockage du mapping dans ISSEG DB
```

#### Synchronisation des Cours

```
1. Enseignant publie un cours (après validation pédagogique)
2. Cours marqué pour sync LMS
3. Moodle-service crée le cours dans Moodle
4. Upload du contenu (PDF, vidéos, quizz)
5. Inscription automatique des étudiants du cours
6. Notification aux étudiants
```

### 3.3 API Moodle Service

```typescript
// Depuis apps/api vers services/moodle-service

POST http://moodle-service:4000/api/sync/user
{
  issegUserId: "uuid",
  email: "mamadou.diallo@isseg.edu",
  firstName: "Mamadou",
  lastName: "DIALLO",
  role: "student"
}

POST http://moodle-service:4000/api/sync/course
{
  issegCourseId: "uuid",
  courseCode: "SEDU-L3-S1-101",
  title: "Psychologie de l'Éducation",
  instructorMoodleId: 42,
  students: [123, 456, 789]  // Moodle user IDs
}
```

### 3.4 Synchronisation Bidirectionnelle

**ISSEG → Moodle**:
- Création de comptes utilisateurs
- Publication de cours validés
- Inscription des étudiants

**Moodle → ISSEG**:
- Import des notes de quiz/devoirs
- Suivi de participation (temps de connexion, modules complétés)
- Données d'activité pour le portail parent

---

## 4. Bulletins et Relevés de Notes

### 4.1 Génération Automatique

Après validation au **Grand Conseil** (Stage 5) :

1. Job BullMQ déclenché automatiquement
2. Worker génère le bulletin PDF (apps/worker)
3. Template avec en-tête ISSEG, logo, signature numérique
4. Upload vers S3/MinIO
5. Notification étudiant + disponibilité sur le portail

### 4.2 Structure du Bulletin

```
┌────────────────────────────────────────────┐
│   INSTITUT SUPÉRIEUR DES SCIENCES DE       │
│   L'ÉDUCATION DE GUINÉE (ISSEG)            │
│                                            │
│   RELEVÉ DE NOTES - Semestre 1 2024-2025   │
├────────────────────────────────────────────┤
│ Étudiant: DIALLO Mamadou                   │
│ Matricule: ISSEG-2024-0123                 │
│ Programme: Licence Sciences de l'Éducation │
│ Niveau: L3                                 │
├────────────────────────────────────────────┤
│ COURS                    | NOTE | CRÉDITS  │
├────────────────────────────────────────────┤
│ Psychologie Éducation    | 14.5 |    6     │
│ Didactique Générale      | 12.0 |    5     │
│ ...                                        │
├────────────────────────────────────────────┤
│ MOYENNE GÉNÉRALE:  13.2 / 20               │
│ CRÉDITS OBTENUS:   28 / 30                 │
│ DÉCISION:          ADMIS                   │
├────────────────────────────────────────────┤
│ Validé par le Grand Conseil                │
│ Date: 15/12/2024                           │
│ Signature électronique: Dr. CAMARA         │
│                                            │
│ Document authentifiable via QR Code        │
└────────────────────────────────────────────┘
```

### 4.3 API Bulletins

```typescript
GET /api/v1/pedagogie/bulletins/etudiant/:matricule
Query: ?semestre=S1&annee=2024-2025

Response:
{
  etudiant: {...},
  semestre: "S1",
  anneeAcademique: "2024-2025",
  cours: [
    {
      code: "SEDU-L3-S1-101",
      titre: "Psychologie de l'Éducation",
      noteFinale: 14.5,
      credits: 6,
      mention: "Bien"
    }
  ],
  moyenneGenerale: 13.2,
  creditsObtenus: 28,
  creditsTotaux: 30,
  decision: "ADMIS",
  urlPdf: "https://s3.isseg.edu/bulletins/ISSEG-2024-0123-S1-2024.pdf",
  validePar: "Dr. CAMARA",
  dateValidation: "2024-12-15T16:00:00Z"
}
```

---

## 5. Gestion des Départements et Sections

### 5.1 Les 4 Départements de l'ISSEG

| Code | Nom Complet | Responsabilités |
|------|-------------|-----------------|
| SEDU | Sciences de l'Éducation | Pédagogie, psychologie, administration scolaire |
| DID  | Didactique | Méthodologies d'enseignement, formation des enseignants |
| SDL  | Sciences du Langage | Linguistique, français, langues étrangères |
| SSOC | Sciences Sociales | Sociologie de l'éducation, anthropologie |

### 5.2 Sections par Département

Chaque département a plusieurs **sections** (équipes pédagogiques par niveau ou spécialité).

Exemple pour Sciences de l'Éducation :
- Section Licence 1
- Section Licence 2
- Section Licence 3
- Section Master 1
- Section Master 2

### 5.3 Rôle du Chef de Département

- Valider les notes (Stage 3 du workflow)
- Gérer les ressources pédagogiques du département
- Affecter les enseignants aux cours
- Superviser les sections
- Participer aux décisions d'orientation/réorientation

---

## 6. Portail Parent (Suivi Étudiant)

### 6.1 Fonctionnalités

Les parents (avec rôle `PARENT`) peuvent :
- Consulter les notes de leur enfant (après publication Grand Conseil)
- Voir l'assiduité (présences/absences via Moodle)
- Accéder aux bulletins PDF
- Contacter l'administration (messagerie intégrée)

### 6.2 Liaison Parent-Étudiant

```prisma
model LienParental {
  id          String @id @default(cuid())
  parentId    String  // Utilisateur avec rôle PARENT
  etudiantId  String
  lien        String  // "PERE", "MERE", "TUTEUR"
  valide      Boolean @default(false)  // Nécessite validation scolarité

  createdAt   DateTime @default(now())
}
```

### 6.3 API Portail Parent

```typescript
GET /api/v1/pedagogie/parent/suivi/:etudiantId
Headers: Authorization: Bearer <parent_token>

Response:
{
  etudiant: {
    nom: "DIALLO",
    prenom: "Mamadou",
    matricule: "ISSEG-2024-0123",
    niveau: "L3",
    programme: "Licence Sciences de l'Éducation"
  },
  notesRecentes: [
    {
      cours: "Psychologie de l'Éducation",
      noteFinale: 14.5,
      datePublication: "2024-12-15"
    }
  ],
  assiduite: {
    tauxPresence: 0.92,  // 92%
    absencesInjustifiees: 2,
    dernierCours: "2024-12-18"
  },
  bulletins: [
    {
      semestre: "S1",
      annee: "2024-2025",
      urlPdf: "https://...",
      moyenneGenerale: 13.2
    }
  ]
}
```

---

## 7. Jobs Asynchrones (apps/worker)

### 7.1 Job: Publication Bulletins

```typescript
@Processor('pedagogie-jobs')
export class PedagogieJobsProcessor {
  @Process('publier-bulletins')
  async publierBulletins(job: Job<{ semestreId: string }>) {
    const { semestreId } = job.data;

    // 1. Récupérer tous les étudiants du semestre
    const etudiants = await this.prisma.etudiant.findMany({...});

    for (const etudiant of etudiants) {
      // 2. Générer le bulletin PDF
      const pdfBuffer = await this.generateBulletinPDF(etudiant, semestreId);

      // 3. Upload S3
      const url = await this.storageService.upload(pdfBuffer, `bulletins/${etudiant.matricule}-${semestreId}.pdf`);

      // 4. Enregistrement en DB
      await this.prisma.bulletin.create({...});

      // 5. Notification étudiant + parent
      await this.notificationService.notifyBulletinReady(etudiant.id, url);
    }

    job.progress(100);
  }
}
```

---

## 8. Tests Critiques

### 8.1 Test du Workflow de Validation

```typescript
describe('5-Stage Note Validation Workflow', () => {
  it('should validate notes through all 5 stages', async () => {
    // 1. Enseignant saisit les notes
    const notes = await request(app)
      .post('/api/v1/pedagogie/notes/saisir')
      .send({ coursId, evaluations })
      .expect(201);

    expect(notes.body.statut).toBe('ATTENTE_SECTION');

    // 2. Validation Section
    await request(app)
      .post('/api/v1/pedagogie/notes/valider')
      .send({ cohorteNotesId, stageActuel: 'ATTENTE_SECTION', decision: 'APPROUVE' })
      .expect(200);

    // 3-5. Validation stages suivants...
    // (Comité Programme, Conseil Département, Commission Pédagogique, Grand Conseil)

    // Final: Vérifier publication
    const bulletin = await request(app)
      .get(`/api/v1/pedagogie/bulletins/etudiant/${matricule}`)
      .expect(200);

    expect(bulletin.body.decision).toBe('ADMIS');
  });

  it('should reject notes at stage 3 and allow correction', async () => {
    // Simulation d'un rejet au Conseil de Département
    const rejection = await request(app)
      .post('/api/v1/pedagogie/notes/valider')
      .send({
        cohorteNotesId,
        stageActuel: 'ATTENTE_CONSEIL_DEPT',
        decision: 'REJETE',
        motifRejet: 'Incohérences détectées dans les moyennes'
      })
      .expect(200);

    expect(rejection.body.statut).toBe('REJETE');
  });
});
```

---

## 9. Optimisations & Performance

### 9.1 Calcul des Moyennes (Triggers PostgreSQL)

```sql
-- Automatiser le calcul de noteFinale lors de l'insertion/update
CREATE OR REPLACE FUNCTION calculate_note_finale()
RETURNS TRIGGER AS $$
BEGIN
  NEW.noteFinale := (
    (NEW.noteCC * NEW.coefficientCC) +
    (NEW.noteTP * NEW.coefficientTP) +
    (NEW.noteExamen * NEW.coefficientExam)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_note
BEFORE INSERT OR UPDATE ON "Evaluation"
FOR EACH ROW
EXECUTE FUNCTION calculate_note_finale();
```

### 9.2 Cache Redis pour Bulletins

```typescript
// Cache des bulletins publiés (immutables)
const bulletinKey = `bulletin:${matricule}:${semestre}:${annee}`;
const cached = await redis.get(bulletinKey);

if (cached) {
  return JSON.parse(cached);
}

const bulletin = await generateBulletin(matricule, semestre, annee);
await redis.set(bulletinKey, JSON.stringify(bulletin)); // Pas d'expiration (immutable)
return bulletin;
```

---

## Résumé des Points Clés

✅ **Workflow 5 stages** : Validation obligatoire à chaque niveau (Section → Grand Conseil)
✅ **Immutabilité post-publication** : Notes figées après Grand Conseil, amendement formel requis
✅ **Intégration LMS** : Déléguer sync lourde à `services/moodle-service`
✅ **Génération bulletins** : Jobs asynchrones via BullMQ
✅ **Portail parent** : Accès en lecture seule aux notes et assiduité
✅ **Audit trail** : Traçabilité complète de chaque validation

**Fichiers Clés** :
- `apps/api/src/modules/pedagogie/` : Contrôleurs notes, cours, bulletins
- `apps/api/prisma/schema.prisma` : Modèles Evaluation, ValidationNote, Cours, Departement
- `apps/worker/src/jobs/pedagogie-jobs.ts` : Génération bulletins, sync LMS
- `services/moodle-service/` : Microservice d'intégration Moodle
