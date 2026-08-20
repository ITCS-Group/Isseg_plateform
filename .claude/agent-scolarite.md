# Agent Scolarité — Module d'Inscription et Administration Scolaire

Ce fichier fournit un contexte détaillé pour le module **Scolarité** de la plateforme ISSEG.

## Périmètre Fonctionnel

Le module Scolarité gère l'ensemble du cycle de vie administratif de l'étudiant :

1. **Inscription et Réinscription**
2. **Gestion des Dossiers Étudiants**
3. **Demandes de Documents Officiels**
4. **Congés Académiques**
5. **Circuit de Signature et Validation des Diplômes**
6. **Vérification de Régularité (API pour autres modules)**

---

## 1. Inscription et Réinscription

### 1.1 Intégration Parcoursup

**Contexte**: La plateforme ISSEG s'intègre avec le système national guinéenne **Parcoursup** pour la gestion des inscriptions.

#### Système de Double Identification

- **INE (Identifiant National Étudiant)**:
  - Fourni par Parcoursup pour les étudiants issus du système guinéenne
  - Format: 11 caractères (10 chiffres + 1 lettre clé)
  - Unique et permanent tout au long du parcours étudiant

- **Matricule ISSEG**:
  - Attribué localement aux étudiants inscrits directement à l'ISSEG
  - Format: `ISSEG-YYYY-NNNN` (année + numéro séquentiel)
  - Exemple: `ISSEG-2024-0123`

#### Flux d'Inscription Parcoursup

```
1. Import des données depuis Parcoursup (CSV/API)
2. Validation des informations (INE, état civil, filière choisie)
3. Création du dossier étudiant
4. Génération du matricule ISSEG (mapping INE ↔ Matricule)
5. Notification à l'étudiant (email/SMS)
6. Activation du compte (envoi des accès LMS)
```

#### API d'Import

```typescript
POST /api/v1/scolarite/parcoursup/import
Content-Type: multipart/form-data

{
  file: File, // CSV Parcoursup
  anneeAcademique: "2024-2025"
}

Response:
{
  imported: 145,
  duplicates: 3,
  errors: [
    { line: 12, ine: "1234567890A", error: "INE déjà existant" }
  ]
}
```

### 1.2 Inscription Directe (Sans Parcoursup)

Pour les étudiants hors système Parcoursup :

- Création manuelle du dossier par le service scolarité
- Attribution automatique d'un **matricule ISSEG** unique
- Validation des pièces justificatives (bac, relevés, photo, CNI)
- État du dossier: `BROUILLON` → `EN_ATTENTE_VALIDATION` → `VALIDE` → `INSCRIT`

---

## 2. Gestion des Dossiers Étudiants

### 2.1 États du Dossier

```typescript
enum StatutDossier {
  BROUILLON           // En cours de constitution
  EN_ATTENTE_VALIDATION // Soumis, en attente
  VALIDE              // Approuvé par la scolarité
  INSCRIT             // Inscription finalisée (paiement effectué)
  REFUSE              // Dossier rejeté
  ARCHIVE             // Étudiant parti/diplômé
}
```

### 2.2 Pièces Justificatives Requises

| Pièce | Obligatoire | Format | Taille Max |
|-------|-------------|--------|------------|
| Copie CNI/Passeport | ✅ | PDF/JPEG | 2 MB |
| Relevé de notes Bac | ✅ | PDF | 2 MB |
| Photo d'identité | ✅ | JPEG/PNG | 500 KB |
| Certificat de scolarité | ❌ | PDF | 2 MB |
| Attestation de réussite | ❌ | PDF | 2 MB |

### 2.3 Workflow de Validation

```
Étudiant soumet dossier
    ↓
Service Scolarité examine
    ↓
┌─── Pièces complètes? ───┐
│ NON → Demande de complément │
│ OUI → Validation            │
└─────────────────────────────┘
    ↓
Notification à l'étudiant
    ↓
Paiement des frais d'inscription
    ↓
STATUT = INSCRIT
```

---

## 3. Demandes de Documents Officiels

Les étudiants peuvent demander différents types de documents via le portail.

### 3.1 Types de Documents

| Document | Délai | Frais | Autorisation requise |
|----------|-------|-------|----------------------|
| Attestation de scolarité | 24h | Gratuit | Régularité OK |
| Relevé de notes provisoire | 48h | Gratuit | Régularité OK |
| Relevé de notes officiel | 5 jours | 2 000 GNF | Régularité OK + Paiement |
| Attestation de réussite | 48h | Gratuit | Notes validées |
| Duplicata de diplôme | 15 jours | 50 000 GNF | Diplômé + Paiement |

### 3.2 Règles de Délivrance

#### Vérification de Régularité

Avant toute délivrance, le système vérifie :
- ✅ Frais de scolarité à jour
- ✅ Aucune sanction disciplinaire en cours
- ✅ Aucun emprunt bibliothèque en retard
- ✅ Pas de blocage administratif

API exposée pour cette vérification :

```typescript
GET /api/v1/students/:matricule/regularity-status

Response:
{
  isRegular: boolean,
  reason?: string, // Si isRegular = false
  lastPaymentDate?: Date,
  outstandingAmount?: number,
  blockedBy?: string // "SCOLARITE" | "BIBLIOTHEQUE" | "DISCIPLINE"
}
```

### 3.3 Workflow de Génération de Document

```
1. Étudiant fait une demande via le portail
2. Système vérifie la régularité
3. Si régulier:
   a. Génération du PDF (via apps/worker - BullMQ job)
   b. Signature numérique (sceau de l'institution)
   c. Envoi notification + lien de téléchargement
   d. Archivage du document
4. Sinon:
   - Refus avec motif détaillé
```

#### Exemple de Job Worker (PDF Generation)

```typescript
// apps/worker/src/jobs/document-generator.job.ts
@Processor('document-generation')
export class DocumentGenerationProcessor {
  @Process('attestation-scolarite')
  async generateAttestation(job: Job<AttestationPayload>) {
    const { studentId, documentType } = job.data;

    // 1. Récupérer les données étudiant
    const student = await this.prisma.etudiant.findUnique({...});

    // 2. Générer le PDF (Puppeteer/PDFKit)
    const pdfBuffer = await this.pdfService.generateAttestation(student);

    // 3. Uploader vers S3/MinIO
    const url = await this.storageService.upload(pdfBuffer, `attestations/${student.matricule}-${Date.now()}.pdf`);

    // 4. Créer l'enregistrement DocumentOfficiel
    await this.prisma.documentOfficiel.create({
      data: {
        etudiantId: student.id,
        type: 'ATTESTATION_SCOLARITE',
        reference: generateReference(),
        urlPdf: url,
        dateEmission: new Date(),
      }
    });

    // 5. Notification
    await this.notificationService.send({
      userId: student.utilisateurId,
      type: 'DOCUMENT_READY',
      message: 'Votre attestation de scolarité est prête',
      data: { downloadUrl: url }
    });
  }
}
```

---

## 4. Congés Académiques

### 4.1 Types de Congés

- **Congé maladie** (jusqu'à 6 mois, certificat médical requis)
- **Congé maternité/paternité** (selon législation)
- **Congé exceptionnel** (raisons familiales graves)
- **Césure** (année sabbatique, stage longue durée)

### 4.2 Workflow de Demande

```
1. Étudiant soumet demande + justificatifs
2. Service Scolarité examine
3. Validation ou refus (avec motif)
4. Si validé:
   - Suspension temporaire du cursus
   - Conservation du dossier
   - Désactivation temporaire des accès (LMS, bibliothèque)
5. Réintégration:
   - Demande de réinscription
   - Réactivation des accès
```

### 4.3 Impacts Système

Lorsqu'un congé est accordé :
- **Statut étudiant** → `EN_CONGE`
- **Accès LMS** → Désactivé
- **Prêts bibliothèque** → Tous les emprunts doivent être retournés
- **Réinscription automatique** → Notification avant la fin du congé

---

## 5. Circuit de Signature et Validation des Diplômes

### 5.1 Génération du Diplôme

Conditions préalables :
- ✅ Toutes les notes validées (Grand Conseil)
- ✅ Moyenne générale ≥ 10/20
- ✅ Aucune dette financière
- ✅ Mémoire/Projet de fin d'études validé

### 5.2 Workflow de Signature

```
1. Génération automatique du diplôme (PDF template)
2. Vérification par le service scolarité
3. Signature électronique séquentielle:
   a. Chef de département (1ère signature)
   b. DGA Études (2ème signature)
   c. Directeur général (signature finale)
4. Horodatage et sceau officiel
5. Publication et mise à disposition
6. Archivage légal (conservation 50 ans)
```

### 5.3 Authentification des Diplômes

Chaque diplôme possède :
- **Numéro unique** : `DIP-YYYY-DEPT-NNNN`
  - Exemple: `DIP-2024-SEDU-0042` (Dept Sciences de l'Éducation)
- **QR Code** : Lien vers page de vérification publique
- **Hash cryptographique** : Empreinte SHA-256 du document

API de vérification publique :

```typescript
GET /api/v1/public/diplomes/verify/:reference

Response:
{
  valid: true,
  student: {
    nom: "DIALLO",
    prenom: "Mamadou",
    dateNaissance: "1998-05-12"
  },
  diplome: {
    intitule: "Licence Sciences de l'Éducation",
    mention: "Bien",
    dateObtention: "2024-07-15"
  },
  signatures: [
    { role: "Chef de Département", date: "2024-07-16T10:30:00Z" },
    { role: "DGA Études", date: "2024-07-16T14:15:00Z" },
    { role: "Directeur Général", date: "2024-07-17T09:00:00Z" }
  ]
}
```

---

## 6. API de Vérification de Régularité (Bibliothèque)

**Point d'intégration critique** : Le module Bibliothèque doit interroger cette API avant tout prêt.

```typescript
GET /api/v1/students/:matricule/regularity-status

Headers:
  Authorization: Bearer <token>

Réponse si régulier:
{
  isRegular: true,
  student: {
    matricule: "ISSEG-2024-0123",
    nom: "DIALLO",
    prenom: "Mamadou",
    filiere: "Licence Sciences de l'Éducation"
  },
  lastPaymentDate: "2024-09-01T00:00:00Z"
}

Réponse si non régulier:
{
  isRegular: false,
  reason: "Frais de scolarité du semestre en attente",
  outstandingAmount: 500000, // GNF
  blockedBy: "SCOLARITE",
  student: {
    matricule: "ISSEG-2024-0123",
    nom: "DIALLO",
    prenom: "Mamadou"
  }
}
```

### Utilisations de cette API

| Module | Usage |
|--------|-------|
| Bibliothèque | Vérifier avant prêt de livres |
| Pédagogie | Autoriser soumission de devoirs |
| Scolarité | Délivrance de documents officiels |

---

## 7. Modèles de Données Clés

### 7.1 Étudiant

```prisma
model Etudiant {
  id                String   @id @default(cuid())
  ine               String?  @unique  // Si Parcoursup
  matricule         String   @unique  // ISSEG-YYYY-NNNN
  nom               String
  prenom            String
  dateNaissance     DateTime
  lieuNaissance     String
  nationalite       String
  email             String   @unique
  telephone         String

  // Relations
  utilisateur       Utilisateur  @relation(...)
  dossierInscription DossierInscription?
  documentsDemandes  DocumentOfficiel[]
  congesAcademiques  CongeAcademique[]

  // Statut
  statut            StatutEtudiant  // ACTIF, EN_CONGE, DIPLOME, EXCLU

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

### 7.2 DossierInscription

```prisma
model DossierInscription {
  id                String   @id @default(cuid())
  etudiantId        String   @unique
  etudiant          Etudiant @relation(...)

  statut            StatutDossier
  anneeAcademique   String   // "2024-2025"
  filiere           String
  niveau            String   // L1, L2, L3, M1, M2

  // Pièces justificatives (URLs S3/MinIO)
  pieceIdentite     String?
  photoIdentite     String?
  releveNotesBac    String?

  dateValidation    DateTime?
  validePar         String?  // ID utilisateur scolarité

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

### 7.3 DocumentOfficiel

```prisma
model DocumentOfficiel {
  id              String   @id @default(cuid())
  etudiantId      String
  etudiant        Etudiant @relation(...)

  type            TypeDocument  // ATTESTATION_SCOLARITE, RELEVE_NOTES, etc.
  reference       String   @unique  // DOC-2024-NNNN
  urlPdf          String   // Lien S3/MinIO
  hashDocument    String   // SHA-256

  dateEmission    DateTime @default(now())
  emisPar         String   // ID utilisateur scolarité

  // Signature (pour diplômes)
  signatures      SignatureDiplome[]

  createdAt       DateTime @default(now())
}

enum TypeDocument {
  ATTESTATION_SCOLARITE
  RELEVE_NOTES_PROVISOIRE
  RELEVE_NOTES_OFFICIEL
  ATTESTATION_REUSSITE
  DIPLOME
  DUPLICATA_DIPLOME
}
```

---

## 8. Permissions RBAC

### Permissions du rôle SCOLARITE

```typescript
const SCOLARITE_PERMISSIONS = [
  'students.create',
  'students.read',
  'students.update',
  'students.validate-dossier',
  'students.manage-academic-leave',

  'documents.issue-attestation',
  'documents.issue-transcript',
  'documents.validate-diploma',

  'parcoursup.import',
  'parcoursup.map-ine',

  'regularity.check',
  'regularity.update-status',
];
```

---

## 9. Tests Critiques

### 9.1 Test de Régularité

```typescript
describe('Regularity Check API', () => {
  it('should return isRegular=true for student with paid fees', async () => {
    const response = await request(app)
      .get('/api/v1/students/ISSEG-2024-0123/regularity-status')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.isRegular).toBe(true);
  });

  it('should return isRegular=false for student with outstanding fees', async () => {
    // Setup: create student with unpaid fees
    const response = await request(app)
      .get('/api/v1/students/ISSEG-2024-0456/regularity-status')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.isRegular).toBe(false);
    expect(response.body.reason).toContain('Frais de scolarité');
  });
});
```

---

## 10. Optimisations & Performance

### 10.1 Indexation Base de Données

```sql
-- Index critiques pour les requêtes fréquentes
CREATE INDEX idx_etudiant_matricule ON "Etudiant"(matricule);
CREATE INDEX idx_etudiant_ine ON "Etudiant"(ine);
CREATE INDEX idx_dossier_statut ON "DossierInscription"(statut);
CREATE INDEX idx_document_type_etudiant ON "DocumentOfficiel"(type, etudiantId);
```

### 10.2 Cache Redis

Pour la vérification de régularité (appelée fréquemment) :

```typescript
// Cache la régularité pendant 1 heure
const cacheKey = `regularity:${matricule}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const regularity = await checkRegularity(matricule);
await redis.setex(cacheKey, 3600, JSON.stringify(regularity));
return regularity;
```

---

## Résumé des Points Clés

✅ **Intégration Parcoursup** : Gestion du double système INE/Matricule
✅ **Vérification de régularité** : API exposée pour Bibliothèque et autres modules
✅ **Génération de documents** : Jobs asynchrones via BullMQ
✅ **Circuit de signature diplômes** : Workflow multi-étapes avec audit
✅ **Authentification de diplômes** : QR codes + API publique de vérification

**Fichiers Clés** :
- `apps/api/src/modules/scolarite/` : Contrôleurs et services
- `apps/api/prisma/schema.prisma` : Modèles Etudiant, DossierInscription, DocumentOfficiel
- `apps/worker/src/jobs/document-generator.job.ts` : Génération PDF asynchrone
