# Agent Bibliothèque — Module Bibliothèque et Numérisation

Ce fichier fournit un contexte détaillé pour le module **Bibliothèque** de la plateforme ISSEG.

## Périmètre Fonctionnel

Le module Bibliothèque gère :

1. **Gestion du Catalogue (Ouvrages, Périodiques, Ressources Numériques)**
2. **Système de Prêts et Emprunts**
3. **Gestion des Abonnés**
4. **Numérisation des Mémoires et Thèses**
5. **Statistiques et Rapports**
6. **Intégration avec Module Scolarité (Vérification Régularité)**

---

## 1. Organisation de la Bibliothèque

### 1.1 Structure Physique

La bibliothèque de l'ISSEG est organisée en **3 sections principales** :

| Section | Description | Capacité |
|---------|-------------|----------|
| **Section Ouvrages Généraux** | Livres de référence, manuels universitaires | ~5 000 ouvrages |
| **Section Périodiques** | Revues scientifiques, magazines éducatifs | ~200 titres |
| **Section Numérique** | Thèses/mémoires numérisés, e-books, ressources en ligne | ~1 500 documents |

### 1.2 Personnel

| Rôle | Responsabilités |
|------|-----------------|
| **BIBLIOTHECAIRE** | Catalogage, prêts/retours, gestion des abonnés |
| **RESPONSABLE_NUMERISATION** | Digitalisation des mémoires, gestion métadonnées, archivage numérique |
| **RESPONSABLE_BIBLIOTHEQUE** | Supervision générale, acquisitions, budget |

---

## 2. Gestion du Catalogue

### 2.1 Système de Classification

La bibliothèque utilise la **Classification Décimale de Dewey (CDD)** adaptée aux sciences de l'éducation :

```
000 - Généralités (Informatique, Méthodologie)
100 - Philosophie et Psychologie
200 - Religion
300 - Sciences Sociales (dont Éducation)
  370 - Éducation
  371 - Administration scolaire
  372 - Enseignement primaire
  373 - Enseignement secondaire
  374 - Éducation des adultes
400 - Langues
500 - Sciences pures
600 - Sciences appliquées
700 - Arts
800 - Littérature
900 - Histoire et Géographie
```

### 2.2 Modèle de Données Catalogue

```prisma
model Ouvrage {
  id              String @id @default(cuid())
  isbn            String? @unique
  titre           String
  auteur          String
  editeur         String
  anneeEdition    Int
  edition         String?  // "2ème édition", "Édition revue et corrigée"

  // Classification
  cote            String   @unique  // Ex: "370.1-DUR" (Dewey + 3 premières lettres auteur)
  classificationDewey String  // "370.1"
  matieres        String[]  // ["Pédagogie", "Didactique", "Psychologie"]

  // Localisation physique
  sectionId       String
  section         Section @relation(...)
  salle           String   // "Salle A", "Magasin"
  etagere         String   // "A3-2" (Étagère A3, rayon 2)

  // Gestion
  nombreExemplaires Int @default(1)
  exemplairesDisponibles Int
  statut          String   // "DISPONIBLE", "EMPRUNTE", "RESERVE", "PERDU", "EN_RELIURE"

  emprunts        Emprunt[]
  reservations    Reservation[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model Section {
  id          String @id @default(cuid())
  nom         String  // "Ouvrages Généraux", "Périodiques", "Numérique"
  code        String @unique  // "OG", "PER", "NUM"
  description String?

  ouvrages    Ouvrage[]
}
```

### 2.3 API Catalogue

```typescript
// Recherche dans le catalogue
GET /api/v1/bibliotheque/catalogue/search
Query: ?q=psychologie&type=OUVRAGE&section=OG

Response:
{
  results: [
    {
      id: "uuid",
      titre: "Psychologie de l'Éducation",
      auteur: "DURKHEIM, Émile",
      cote: "370.15-DUR",
      section: "Ouvrages Généraux",
      disponible: true,
      nombreExemplaires: 3,
      exemplairesDisponibles: 2
    }
  ],
  total: 1
}

// Détails d'un ouvrage
GET /api/v1/bibliotheque/catalogue/ouvrages/:id

Response:
{
  ...détails complets,
  empruntsActifs: [
    {
      emprunté par: "DIALLO Mamadou (ISSEG-2024-0123)",
      dateEmprunt: "2024-12-01",
      dateRetourPrevue: "2024-12-15"
    }
  ],
  reservations: 0
}
```

---

## 3. Système de Prêts et Emprunts

### 3.1 Règles de Prêt

| Catégorie Emprunteur | Durée Prêt | Nombre Max Simultané | Renouvellement |
|----------------------|------------|----------------------|----------------|
| Étudiant L1-L2 | 14 jours | 3 ouvrages | 1 fois (si aucune réservation) |
| Étudiant L3-M2 | 21 jours | 5 ouvrages | 1 fois |
| Enseignant | 30 jours | 10 ouvrages | 2 fois |
| Personnel Admin | 14 jours | 3 ouvrages | 1 fois |

### 3.2 Workflow de Prêt

**CRITIQUE**: Avant tout prêt, le système **DOIT** vérifier la régularité de l'étudiant via l'API Scolarité.

```
1. Étudiant présente carte + demande livre
2. Bibliothécaire scanne ISBN ou saisit cote
3. ✅ VÉRIFICATION RÉGULARITÉ (API Scolarité)
   ↓
   Si NON RÉGULIER → BLOCAGE + Affichage motif
   Si RÉGULIER → Suite du processus
4. Vérification: nombre max emprunts atteint ?
5. Création emprunt en DB
6. Édition du reçu de prêt
7. Mise à jour stock (exemplairesDisponibles - 1)
```

### 3.3 Vérification de Régularité (Intégration Scolarité)

```typescript
// Appel depuis le module Bibliothèque vers l'API Scolarité
async function verifierRegulariteEtudiant(matricule: string): Promise<boolean> {
  try {
    const response = await axios.get(
      `${SCOLARITE_API_URL}/api/v1/students/${matricule}/regularity-status`,
      {
        headers: {
          Authorization: `Bearer ${SERVICE_TOKEN}`,
        },
      }
    );

    if (!response.data.isRegular) {
      // Bloquer le prêt et afficher le motif
      throw new UnauthorizedException(
        `Prêt refusé: ${response.data.reason || 'Étudiant non régulier'}`
      );
    }

    return true;
  } catch (error) {
    // Log de l'erreur et blocage par sécurité
    this.logger.error(`Erreur vérification régularité pour ${matricule}`, error);
    throw new ServiceUnavailableException('Service de vérification temporairement indisponible');
  }
}
```

### 3.4 Modèle de Données Emprunt

```prisma
model Emprunt {
  id                  String @id @default(cuid())
  ouvrageId           String
  ouvrage             Ouvrage @relation(...)

  emprunteurId        String  // ID Étudiant ou Enseignant
  emprunteur          Utilisateur @relation(...)
  matriculeEmprunteur String  // Pour traçabilité

  dateEmprunt         DateTime @default(now())
  dateRetourPrevue    DateTime
  dateRetourEffectif  DateTime?

  renouvellementsRestants Int @default(1)
  statut              StatutEmprunt  // ACTIF, RETOURNE, EN_RETARD, PERDU

  // Pénalités
  retardJours         Int @default(0)
  montantPenalite     Decimal @default(0)  // GNF
  penalitesPayees     Boolean @default(false)

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}

enum StatutEmprunt {
  ACTIF
  RETOURNE
  EN_RETARD
  PERDU
}
```

### 3.5 Gestion des Retards

**Système de pénalités automatique** :
- **1-7 jours de retard** : Avertissement par email/SMS
- **8-14 jours** : 500 GNF/jour de retard
- **15-30 jours** : 1 000 GNF/jour + blocage compte (interdiction nouveaux prêts)
- **> 30 jours** : Signalement à la scolarité + ouvrage considéré comme perdu (remboursement prix du livre)

```typescript
// Job CRON quotidien pour détecter les retards
@Cron('0 8 * * *') // Tous les jours à 8h
async detecterRetards() {
  const aujourd'hui = new Date();

  const empruntsEnRetard = await this.prisma.emprunt.findMany({
    where: {
      dateRetourPrevue: { lt: aujourd'hui },
      statut: 'ACTIF',
    },
    include: { emprunteur: true, ouvrage: true },
  });

  for (const emprunt of empruntsEnRetard) {
    const joursRetard = differenceInDays(aujourd'hui, emprunt.dateRetourPrevue);

    // Mise à jour statut
    await this.prisma.emprunt.update({
      where: { id: emprunt.id },
      data: {
        statut: 'EN_RETARD',
        retardJours: joursRetard,
        montantPenalite: this.calculerPenalite(joursRetard),
      },
    });

    // Notification
    if (joursRetard === 1 || joursRetard === 7 || joursRetard === 14) {
      await this.notificationService.envoyerRappelRetard(emprunt);
    }

    // Blocage à 15 jours
    if (joursRetard >= 15) {
      await this.bloquerCompteEmprunteur(emprunt.emprunteurId);
    }
  }
}
```

---

## 4. Numérisation des Mémoires et Thèses

### 4.1 Processus de Numérisation

```
1. Réception du mémoire/thèse validé (version papier)
2. Numérisation haute résolution (PDF/A pour archivage)
3. OCR (Reconnaissance optique de caractères) si nécessaire
4. Extraction et saisie des métadonnées:
   - Titre, auteur, année, filière, niveau
   - Mots-clés, résumé
   - Directeur de mémoire
5. Upload vers stockage sécurisé (S3/MinIO)
6. Indexation dans le catalogue
7. Mise en ligne sur le portail (si autorisé par l'étudiant)
```

### 4.2 Modèle de Données Thèse/Mémoire

```prisma
model DocumentAcademique {
  id                String @id @default(cuid())
  type              String  // "THESE", "MEMOIRE_LICENCE", "MEMOIRE_MASTER"
  titre             String
  auteurId          String
  auteur            Etudiant @relation(...)

  // Métadonnées académiques
  anneeUniversitaire String  // "2023-2024"
  filiere           String
  niveau            String  // "L3", "M2"
  directeurMemoire  String  // Nom de l'enseignant

  // Fichiers
  urlPdf            String  // Lien S3/MinIO
  urlCouverture     String? // Image de couverture
  tailleFichier     Int     // En bytes

  // Indexation
  motsCles          String[]
  resume            String @db.Text
  langue            String @default("fr")

  // Droits et diffusion
  diffusionAutorisee Boolean @default(false)  // Accord étudiant
  embargoJusqua     DateTime?  // Si l'étudiant demande un embargo temporaire

  // Statistiques
  nombreTelechargements Int @default(0)
  nombreVues           Int @default(0)

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

### 4.3 API Mémoires Numérisés

```typescript
// Recherche dans les mémoires
GET /api/v1/bibliotheque/memoires/search
Query: ?q=apprentissage&niveau=M2&annee=2024

Response:
{
  results: [
    {
      id: "uuid",
      titre: "L'apprentissage par projet dans l'enseignement primaire",
      auteur: "DIALLO Mamadou",
      niveau: "M2",
      filiere: "Sciences de l'Éducation",
      annee: "2023-2024",
      motsCles: ["apprentissage", "projet", "primaire"],
      urlPreview: "https://...", // Prévisualisation (premières pages)
      telechargeable: true
    }
  ],
  total: 1
}

// Téléchargement (avec tracking)
GET /api/v1/bibliotheque/memoires/:id/download

Response: PDF file (avec incrémentation du compteur de téléchargements)
```

---

## 5. Gestion des Abonnés

### 5.1 Inscription Bibliothèque

Tous les étudiants et enseignants sont **automatiquement abonnés** lors de leur inscription à l'ISSEG.

```typescript
// Event listener sur création d'étudiant
@OnEvent('student.created')
async handleStudentCreated(payload: { studentId: string }) {
  await this.bibliothequeService.creerAbonne({
    utilisateurId: payload.studentId,
    typeAbonne: 'ETUDIANT',
    dateDebut: new Date(),
    dateFin: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // 1 an
    statutActif: true,
  });
}
```

### 5.2 Modèle Abonné

```prisma
model Abonne {
  id              String @id @default(cuid())
  utilisateurId   String @unique
  utilisateur     Utilisateur @relation(...)

  typeAbonne      String  // "ETUDIANT", "ENSEIGNANT", "PERSONNEL"
  dateDebut       DateTime
  dateFin         DateTime
  statutActif     Boolean @default(true)

  // Limites personnalisées (si différent des défauts)
  limiteEmprunts  Int?
  dureePretJours  Int?

  emprunts        Emprunt[]
  reservations    Reservation[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

---

## 6. Statistiques et Rapports

### 6.1 Tableaux de Bord

**Tableau de bord Bibliothécaire** :
- Emprunts du jour
- Retours attendus aujourd'hui
- Retards en cours (avec liste détaillée)
- Ouvrages les plus empruntés du mois
- Nouveaux catalogages de la semaine

**Tableau de bord Direction** :
- Taux d'utilisation de la bibliothèque
- Évolution des emprunts (graphique mensuel)
- Budget acquisitions vs dépenses
- Top 10 ouvrages les plus demandés
- Statistiques de numérisation (nombre de mémoires numérisés)

### 6.2 API Statistiques

```typescript
GET /api/v1/bibliotheque/stats/dashboard
Query: ?period=month&year=2024&month=12

Response:
{
  emprunts: {
    total: 342,
    actifs: 156,
    retournes: 178,
    enRetard: 8
  },
  ouvragesPlusEmpruntes: [
    { titre: "Pédagogie différenciée", emprunts: 23 },
    { titre: "Évaluation scolaire", emprunts: 19 }
  ],
  tauxUtilisation: 0.67,  // 67% des ouvrages empruntés au moins 1 fois
  nouveauxMemoires: 12
}
```

---

## 7. Permissions RBAC

```typescript
const BIBLIOTHEQUE_PERMISSIONS = {
  BIBLIOTHECAIRE: [
    'catalogue.create',
    'catalogue.update',
    'catalogue.delete',
    'emprunts.create',
    'emprunts.process-return',
    'abonnes.read',
    'stats.view-basic',
  ],

  RESPONSABLE_BIBLIOTHEQUE: [
    'catalogue.manage-all',
    'emprunts.manage-all',
    'abonnes.manage',
    'stats.view-advanced',
    'acquisitions.manage',
    'budget.view',
  ],

  RESPONSABLE_NUMERISATION: [
    'memoires.upload',
    'memoires.edit-metadata',
    'memoires.publish',
    'digitization.manage',
  ],

  ETUDIANT: [
    'catalogue.search',
    'catalogue.view',
    'emprunts.view-own',
    'reservations.create',
    'memoires.search',
    'memoires.download', // Si diffusionAutorisee = true
  ],

  ENSEIGNANT: [
    'catalogue.search',
    'catalogue.view',
    'emprunts.view-own',
    'reservations.create-priority',
    'memoires.download',
    'memoires.view-all', // Accès même si diffusionAutorisee = false
  ],
};
```

---

## 8. Tests Critiques

### 8.1 Test de Vérification Régularité

```typescript
describe('Loan Regularity Check', () => {
  it('should block loan if student is not regular', async () => {
    // Mock de l'API Scolarité retournant isRegular = false
    nock(SCOLARITE_API_URL)
      .get('/api/v1/students/ISSEG-2024-0456/regularity-status')
      .reply(200, {
        isRegular: false,
        reason: 'Frais de scolarité impayés',
      });

    const loan = request(app)
      .post('/api/v1/bibliotheque/emprunts')
      .send({
        ouvrageId: 'uuid',
        matriculeEmprunteur: 'ISSEG-2024-0456',
      })
      .expect(403);

    expect(loan.body.message).toContain('Frais de scolarité impayés');
  });

  it('should allow loan if student is regular', async () => {
    nock(SCOLARITE_API_URL)
      .get('/api/v1/students/ISSEG-2024-0123/regularity-status')
      .reply(200, { isRegular: true });

    const loan = await request(app)
      .post('/api/v1/bibliotheque/emprunts')
      .send({
        ouvrageId: 'uuid',
        matriculeEmprunteur: 'ISSEG-2024-0123',
      })
      .expect(201);

    expect(loan.body.statut).toBe('ACTIF');
  });
});
```

### 8.2 Test Gestion Retards

```typescript
describe('Late Return Detection', () => {
  it('should detect and penalize late returns', async () => {
    // Créer un emprunt avec date retour dépassée de 10 jours
    const emprunt = await prisma.emprunt.create({
      data: {
        ouvrageId: 'uuid',
        emprunteurId: 'uuid',
        dateEmprunt: subDays(new Date(), 24),
        dateRetourPrevue: subDays(new Date(), 10),
        statut: 'ACTIF',
      },
    });

    // Exécuter le job de détection des retards
    await bibliothequeService.detecterRetards();

    // Vérifier la mise à jour
    const empruntMisAJour = await prisma.emprunt.findUnique({
      where: { id: emprunt.id },
    });

    expect(empruntMisAJour.statut).toBe('EN_RETARD');
    expect(empruntMisAJour.retardJours).toBe(10);
    expect(empruntMisAJour.montantPenalite).toBe(5000); // 500 GNF × 10 jours
  });
});
```

---

## 9. Optimisations & Performance

### 9.1 Indexation Base de Données

```sql
-- Index pour recherche catalogue
CREATE INDEX idx_ouvrage_titre ON "Ouvrage" USING gin(to_tsvector('french', titre));
CREATE INDEX idx_ouvrage_auteur ON "Ouvrage" USING gin(to_tsvector('french', auteur));
CREATE INDEX idx_ouvrage_cote ON "Ouvrage"(cote);
CREATE INDEX idx_ouvrage_section ON "Ouvrage"(sectionId);

-- Index pour emprunts actifs
CREATE INDEX idx_emprunt_statut ON "Emprunt"(statut);
CREATE INDEX idx_emprunt_emprunteur ON "Emprunt"(emprunteurId);
CREATE INDEX idx_emprunt_retour_prevue ON "Emprunt"(dateRetourPrevue) WHERE statut = 'ACTIF';
```

### 9.2 Cache Redis

```typescript
// Cache des ouvrages les plus consultés
const ouvrageKey = `ouvrage:${id}`;
const cached = await redis.get(ouvrageKey);

if (cached) {
  return JSON.parse(cached);
}

const ouvrage = await prisma.ouvrage.findUnique({ where: { id } });
await redis.setex(ouvrageKey, 3600, JSON.stringify(ouvrage)); // 1h
return ouvrage;

// Cache de la vérification de régularité (partagé avec Scolarité)
const regularityKey = `regularity:${matricule}`;
// Utiliser le cache si disponible pour éviter de surcharger l'API Scolarité
```

---

## Résumé des Points Clés

✅ **Vérification régularité obligatoire** : Appel API Scolarité avant chaque prêt
✅ **Classification Dewey** : Standard international adapté aux sciences de l'éducation
✅ **Gestion automatisée des retards** : Job CRON quotidien + pénalités progressives
✅ **Numérisation des mémoires** : Workflow complet (OCR, métadonnées, diffusion conditionnelle)
✅ **Statistiques avancées** : Tableaux de bord pour bibliothécaires et direction
✅ **Intégration automatique** : Abonnés créés lors de l'inscription ISSEG

**Fichiers Clés** :
- `apps/api/src/modules/bibliotheque/` : Contrôleurs catalogue, emprunts, numérisation
- `apps/api/prisma/schema.prisma` : Modèles Ouvrage, Emprunt, DocumentAcademique, Abonne
- `apps/worker/src/jobs/bibliotheque-jobs.ts` : Détection retards, notifications, statistiques
