import { PrismaClient, StatutValidation, TypeEpreuve } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ⚠️ Mot de passe temporaire PARTAGÉ par tous les comptes de test créés
// ci-dessous. À faire tourner avant tout usage réel — ne jamais laisser
// ces comptes actifs avec ce mot de passe sur un environnement exposé.
const TEST_PASSWORD = 'ChangeMe123!';

// Rôles applicatifs à créer, basés sur les guards @Roles() réellement
// présents dans le code (registration.controller.ts, cours-classe/epreuve/
// note-etudiant.controller.ts). Ne pas en ajouter d'autres ici sans un
// usage correspondant vérifié dans le code — cf. audit RBAC de session.
export const TEST_ROLES = [
  { nomRole: 'SCOLARITE', nom: 'Scolarité', prenom: 'Test' },
  { nomRole: 'ENSEIGNANT', nom: 'Enseignant', prenom: 'Test' },
  { nomRole: 'CHEF_DEPARTEMENT', nom: 'Chef Département', prenom: 'Test' },
  { nomRole: 'DGA_ETUDES', nom: 'DGA Études', prenom: 'Test' },
  // Bibliothèque (chantier feature/bibliotheque) : ces 4 rôles ont désormais
  // de vraies routes @Roles() derrière eux (ouvrages/emprunts/réservations/
  // documents-académiques/abonnés) — déplacés depuis AUTH_ONLY_ROLES pour
  // BIBLIOTHECAIRE/RESPONSABLE_NUMERISATION/ETUDIANT (même raisonnement que
  // les 4 rôles ci-dessus). RESPONSABLE_BIBLIOTHEQUE est un rôle nouveau
  // (décision utilisateur du 19/08 : distinct de BIBLIOTHECAIRE/ADMIN,
  // supervision générale/acquisitions/budget).
  { nomRole: 'BIBLIOTHECAIRE', nom: 'Bibliothécaire', prenom: 'Test' },
  { nomRole: 'RESPONSABLE_NUMERISATION', nom: 'Responsable Numérisation', prenom: 'Test' },
  { nomRole: 'RESPONSABLE_BIBLIOTHEQUE', nom: 'Responsable Bibliothèque', prenom: 'Test' },
  { nomRole: 'ETUDIANT', nom: 'Étudiant', prenom: 'Test' },
  // Support Informatique (chantier feat/support-it-module) : RESPONSABLE_IT
  // sort d'AUTH_ONLY_ROLES (chef de service, supervise tous les
  // sous-services — routes Requêtes/Interventions/Cours/Postes/Messagerie/
  // synthèse). TECHNICIEN est un rôle nouveau, distinct de RESPONSABLE_IT :
  // ne traite que les requêtes de son propre sous-service (cf. Technicien.
  // sousService dans le schéma Prisma).
  { nomRole: 'RESPONSABLE_IT', nom: 'Responsable IT', prenom: 'Test' },
  { nomRole: 'TECHNICIEN', nom: 'Technicien', prenom: 'Test' },
];

// Permissions minimales, alignées sur les @Roles() déjà en place :
// - SCOLARITE gère seule le cycle de vie d'un dossier d'inscription
//   (submit/start-processing/register/reject sur registration.controller.ts).
// - ENSEIGNANT et DGA_ETUDES peuvent créer/modifier
//   (cours-classe, épreuve, note-etudiant) ; CHEF_DEPARTEMENT n'a
//   aujourd'hui que la lecture sur ces 3 ressources dans le code.
// Note : aucun controller n'utilise encore @Permissions() (RBAC actuel =
// @Roles() seul) — ces lignes préparent la donnée pour un futur usage,
// sans changer le comportement des guards existants.
// Rôles documentés dans CLAUDE.md mais sans module métier existant derrière
// (Bibliothèque, Finance/RH, Innovation Numérique, Départements, portails
// Étudiant/Parent n'existent pas encore côté code). Seedés uniquement pour
// que l'authentification/RBAC soit testable de bout en bout — AUCUNE route
// ne les référence dans un guard @Roles() à ce jour, donc AUCUNE permission
// n'est créée pour eux (une permission sans route derrière n'aurait aucun
// sens). SUPER_ADMIN : traité comme strictement identique à ADMIN pour
// l'instant (même absence de permission qu'ADMIN aujourd'hui) — aucune
// distinction n'existe nulle part dans le code entre les deux ; à
// différencier plus tard si un besoin métier concret apparaît, décision
// prise avec l'utilisateur, pas supposée.
export const AUTH_ONLY_ROLES = [
  { nomRole: 'SUPER_ADMIN', nom: 'Super Admin', prenom: 'Test' },
  { nomRole: 'COMPTABLE', nom: 'Comptable', prenom: 'Test' },
  { nomRole: 'RH', nom: 'RH', prenom: 'Test' },
  { nomRole: 'DIRECTEUR_GENERAL', nom: 'Directeur Général', prenom: 'Test' },
  { nomRole: 'DIRECTEUR_INNOVATION', nom: 'Directeur Innovation', prenom: 'Test' },
  { nomRole: 'RESPONSABLE_PUBLICATIONS', nom: 'Responsable Publications', prenom: 'Test' },
  { nomRole: 'PARENT', nom: 'Parent', prenom: 'Test' },
];

export const TEST_PERMISSIONS: Array<{
  nomPermission: string;
  description: string;
  roles: string[];
}> = [
  {
    nomPermission: 'MANAGE_DOSSIER_INSCRIPTION',
    description:
      "Gérer le cycle de vie d'un dossier d'inscription (soumission, traitement, enregistrement, rejet)",
    roles: ['SCOLARITE'],
  },
  {
    nomPermission: 'READ_PEDAGOGIE',
    description: 'Consulter les cours-classes, épreuves et notes des étudiants',
    roles: ['ENSEIGNANT', 'CHEF_DEPARTEMENT', 'DGA_ETUDES'],
  },
  {
    nomPermission: 'MANAGE_PEDAGOGIE',
    description: 'Créer/modifier les cours-classes, épreuves et notes des étudiants',
    roles: ['ENSEIGNANT', 'DGA_ETUDES'],
  },
  {
    nomPermission: 'MANAGE_BIBLIOTHEQUE',
    description: 'Gérer le catalogue, les emprunts et les abonnés de la Bibliothèque',
    roles: ['BIBLIOTHECAIRE', 'RESPONSABLE_BIBLIOTHEQUE'],
  },
  {
    nomPermission: 'MANAGE_NUMERISATION',
    description: 'Cataloguer et diffuser les documents académiques numérisés (thèses/mémoires)',
    roles: ['RESPONSABLE_NUMERISATION'],
  },
  {
    nomPermission: 'READ_BIBLIOTHEQUE',
    description: 'Consulter le catalogue, emprunter et réserver des ouvrages',
    roles: ['ETUDIANT', 'ENSEIGNANT'],
  },
  {
    nomPermission: 'MANAGE_SUPPORT_IT',
    description:
      'Superviser tous les sous-services Support Informatique (requêtes, cours, postes, messagerie, synthèse mensuelle)',
    roles: ['RESPONSABLE_IT'],
  },
  {
    nomPermission: 'TRAITER_REQUETES_SUPPORT_IT',
    description:
      "Traiter les requêtes et interventions du sous-service auquel le technicien est affecté (Technicien.sousService)",
    roles: ['TECHNICIEN'],
  },
];

async function main() {
  console.log('🌱 Starting seed...');

  // Charger les variables d'environnement depuis le .env
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminNom = process.env.ADMIN_NOM;
  const adminPrenom = process.env.ADMIN_PRENOM;

  // Validation des variables d'environnement
  if (!adminEmail || !adminPassword || !adminNom || !adminPrenom) {
    throw new Error(
      'Missing required environment variables: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NOM, ADMIN_PRENOM',
    );
  }

  console.log(`📧 Admin email: ${adminEmail}`);

  // Utiliser une transaction pour garantir la cohérence
  await prisma.$transaction(async (tx) => {
    // 1. Créer ou récupérer le rôle ADMIN
    const roleAdmin = await tx.role.upsert({
      where: { nomRole: 'ADMIN' },
      update: {},
      create: {
        nomRole: 'ADMIN',
      },
    });

    console.log(`✅ Role ADMIN: ${roleAdmin.id}`);

    // 2. Vérifier si l'utilisateur admin existe déjà
    let adminUser = await tx.utilisateur.findUnique({
      where: { email: adminEmail },
    });

    if (adminUser) {
      console.log(`ℹ️  Admin user already exists: ${adminUser.email}`);
    } else {
      // 3. Hasher le mot de passe avec bcrypt
      const motDePasseHash = await bcrypt.hash(adminPassword, 10);

      // 4. Créer l'utilisateur administrateur
      adminUser = await tx.utilisateur.create({
        data: {
          nom: adminNom,
          prenom: adminPrenom,
          email: adminEmail,
          motDePasseHash,
          estActif: true,
          loginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: null,
        },
      });

      console.log(`✅ Admin user created: ${adminUser.email}`);
    }

    // 5. Créer la relation UtilisateurRole si elle n'existe pas
    const existingRelation = await tx.utilisateurRole.findUnique({
      where: {
        utilisateurId_roleId: {
          utilisateurId: adminUser.id,
          roleId: roleAdmin.id,
        },
      },
    });

    if (!existingRelation) {
      await tx.utilisateurRole.create({
        data: {
          utilisateurId: adminUser.id,
          roleId: roleAdmin.id,
        },
      });

      console.log(`✅ Role ADMIN assigned to user ${adminUser.email}`);
    } else {
      console.log(`ℹ️  Role ADMIN already assigned to user ${adminUser.email}`);
    }
  });

  // ── Rôles applicatifs, permissions et comptes de test ──────────────────
  // timeout étendu : ce bloc fait ~20 allers-retours séquentiels, au-delà
  // du défaut Prisma (5000ms) avec la latence réseau vers Neon.
  await prisma.$transaction(
    async (tx) => {
    // 1. Créer ou récupérer les rôles (idempotent, même pattern que ADMIN)
    const roleByName: Record<string, { id: string }> = {};

    for (const r of TEST_ROLES) {
      const role = await tx.role.upsert({
        where: { nomRole: r.nomRole },
        update: {},
        create: { nomRole: r.nomRole },
      });
      roleByName[r.nomRole] = role;
      console.log(`✅ Role ${r.nomRole}: ${role.id}`);
    }

    // 2. Créer ou récupérer les permissions, puis les attacher aux rôles
    for (const p of TEST_PERMISSIONS) {
      const permission = await tx.permission.upsert({
        where: { nomPermission: p.nomPermission },
        update: { description: p.description },
        create: { nomPermission: p.nomPermission, description: p.description },
      });
      console.log(`✅ Permission ${p.nomPermission}: ${permission.id}`);

      for (const roleName of p.roles) {
        const role = roleByName[roleName];
        const existingLink = await tx.rolePermission.findUnique({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
        });

        if (!existingLink) {
          await tx.rolePermission.create({
            data: { roleId: role.id, permissionId: permission.id },
          });
          console.log(`✅ Permission ${p.nomPermission} attachée au rôle ${roleName}`);
        } else {
          console.log(`ℹ️  Permission ${p.nomPermission} déjà attachée au rôle ${roleName}`);
        }
      }
    }

    // 3. Créer un compte de test par rôle (email {role}@isseg.local, mot de
    //    passe temporaire partagé — voir TEST_PASSWORD en tête de fichier)
    const testPasswordHash = await bcrypt.hash(TEST_PASSWORD, 10);

    for (const r of TEST_ROLES) {
      const email = `${r.nomRole.toLowerCase()}@isseg.local`;

      let testUser = await tx.utilisateur.findUnique({ where: { email } });

      if (testUser) {
        console.log(`ℹ️  Test user already exists: ${testUser.email}`);
      } else {
        testUser = await tx.utilisateur.create({
          data: {
            nom: r.nom,
            prenom: r.prenom,
            email,
            motDePasseHash: testPasswordHash,
            estActif: true,
            loginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: null,
          },
        });
        console.log(`✅ Test user created: ${testUser.email}`);
      }

      const role = roleByName[r.nomRole];
      const existingRelation = await tx.utilisateurRole.findUnique({
        where: {
          utilisateurId_roleId: {
            utilisateurId: testUser.id,
            roleId: role.id,
          },
        },
      });

      if (!existingRelation) {
        await tx.utilisateurRole.create({
          data: { utilisateurId: testUser.id, roleId: role.id },
        });
        console.log(`✅ Role ${r.nomRole} assigned to user ${testUser.email}`);
      } else {
        console.log(`ℹ️  Role ${r.nomRole} already assigned to user ${testUser.email}`);
      }
    }
    },
    { timeout: 20_000 },
  );

  // ── Rôles "auth-only" (7) — sans module métier, sans permission ────────
  // Pas de $transaction ici : chaque étape est indépendamment idempotente
  // (upsert / find-then-create), pas besoin d'atomicité entre 11 rôles
  // indépendants, et ça évite le risque de timeout déjà rencontré sur Neon
  // avec un grand nombre d'allers-retours dans une seule transaction.
  const authOnlyPasswordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  for (const r of AUTH_ONLY_ROLES) {
    const role = await prisma.role.upsert({
      where: { nomRole: r.nomRole },
      update: {},
      create: { nomRole: r.nomRole },
    });
    console.log(`✅ Role ${r.nomRole}: ${role.id}`);

    const email = `${r.nomRole.toLowerCase()}@isseg.local`;
    let authOnlyUser = await prisma.utilisateur.findUnique({ where: { email } });

    if (authOnlyUser) {
      console.log(`ℹ️  Test user already exists: ${authOnlyUser.email}`);
    } else {
      authOnlyUser = await prisma.utilisateur.create({
        data: {
          nom: r.nom,
          prenom: r.prenom,
          email,
          motDePasseHash: authOnlyPasswordHash,
          estActif: true,
          loginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: null,
        },
      });
      console.log(`✅ Test user created: ${authOnlyUser.email}`);
    }

    const existingAuthOnlyRelation = await prisma.utilisateurRole.findUnique({
      where: {
        utilisateurId_roleId: { utilisateurId: authOnlyUser.id, roleId: role.id },
      },
    });

    if (!existingAuthOnlyRelation) {
      await prisma.utilisateurRole.create({
        data: { utilisateurId: authOnlyUser.id, roleId: role.id },
      });
      console.log(`✅ Role ${r.nomRole} assigned to user ${authOnlyUser.email}`);
    } else {
      console.log(`ℹ️  Role ${r.nomRole} already assigned to user ${authOnlyUser.email}`);
    }
  }

  // Seed des filières de référence (idempotent via upsert sur `code`)
  const filieres = [
    { code: 'SEDU', nom: "Sciences de l'Éducation" },
    { code: 'DID', nom: 'Didactique' },
    { code: 'SDL', nom: 'Sciences du Langage' },
    { code: 'SSOC', nom: 'Sciences Sociales' },
  ];

  for (const f of filieres) {
    const filiere = await prisma.filiere.upsert({
      where: { code: f.code },
      update: { nom: f.nom },
      create: { code: f.code, nom: f.nom },
    });
    console.log(`✅ Filière ${filiere.code}: ${filiere.nom}`);
  }

  // Seed des sections Bibliothèque de référence (idempotent via upsert sur
  // `code`) — mêmes 3 catégories physiques qu'agent-bibliotheque.md §2
  // (Ouvrages Généraux/Périodiques/Numérique), nécessaires à tout POST
  // /ouvrages (sectionId obligatoire). Pas d'endpoint CRUD dédié pour
  // l'instant (décision utilisateur du 19/08) — même pattern que `filieres`.
  const sectionsBibliotheque = [
    { code: 'OG', nom: 'Ouvrages Généraux' },
    { code: 'PER', nom: 'Périodiques' },
    { code: 'NUM', nom: 'Numérique' },
  ];

  for (const s of sectionsBibliotheque) {
    const section = await prisma.sectionBibliotheque.upsert({
      where: { code: s.code },
      update: { nom: s.nom },
      create: { code: s.code, nom: s.nom },
    });
    console.log(`✅ SectionBibliotheque ${section.code}: ${section.nom}`);
  }

  // ── Données de démonstration : enseignant de test lié + 1 cours/classe/
  // épreuve + 3 étudiants notés ────────────────────────────────────────────
  // Sans ces données, le dashboard enseignant affichera une liste vide une
  // fois branché sur l'API réelle — impossible de distinguer "ça marche
  // mais il n'y a rien à afficher" de "ça ne marche pas".
  const filiereSedu = await prisma.filiere.findUniqueOrThrow({ where: { code: 'SEDU' } });

  const anneeDemo = await prisma.anneeUniversitaire.upsert({
    where: { libelle: '2025-2026' },
    update: {},
    create: {
      libelle: '2025-2026',
      dateDebut: new Date('2025-09-01'),
      dateFin: new Date('2026-07-31'),
      estActive: true,
    },
  });
  console.log(`✅ AnneeUniversitaire démo: ${anneeDemo.libelle}`);

  const classeDemo = await prisma.classe.upsert({
    where: { codeClasse: 'SEDU-L3-A' },
    update: {},
    create: {
      codeClasse: 'SEDU-L3-A',
      libelle: 'Licence 3 - Section A',
      niveau: 'L3',
      filiereId: filiereSedu.id,
    },
  });
  console.log(`✅ Classe démo: ${classeDemo.codeClasse}`);

  const enseignantTestUser = await prisma.utilisateur.findUnique({
    where: { email: 'enseignant@isseg.local' },
  });

  if (!enseignantTestUser) {
    console.log(
      'ℹ️  Compte enseignant@isseg.local introuvable — étape de démo pédagogie ignorée (relancer le seed en entier).',
    );
  } else {
    const personnelDemo = await prisma.personnel.upsert({
      where: { userId: enseignantTestUser.id },
      update: {},
      create: {
        userId: enseignantTestUser.id,
        matricule: 'PERS-ENS-DEMO',
        poste: 'Enseignant-chercheur',
        dateEmbauche: new Date('2020-09-01'),
        salaire: 0,
      },
    });
    console.log(`✅ Personnel démo lié à enseignant@isseg.local: ${personnelDemo.matricule}`);

    const enseignantDemo = await prisma.enseignant.upsert({
      where: { personnelId: personnelDemo.id },
      update: {},
      create: {
        personnelId: personnelDemo.id,
        specialite: "Sciences de l'Éducation",
        grade: 'Maître-Assistant',
      },
    });
    console.log(`✅ Enseignant démo (lié à enseignant@isseg.local): ${enseignantDemo.id}`);

    const coursDemo = await prisma.coursScenarise.upsert({
      where: { codeCours: 'SEDU-L3-S1-101' },
      update: {},
      create: {
        enseignantId: enseignantDemo.id,
        titre: "Psychologie de l'Éducation",
        codeCours: 'SEDU-L3-S1-101',
        description: 'Cours de démonstration (données de seed).',
        objectifsPedagogiques: 'Données de démonstration pour le développement du frontend.',
        statutValidation: StatutValidation.APPROUVE,
      },
    });
    console.log(`✅ CoursScenarise démo: ${coursDemo.codeCours}`);

    const coursClasseDemo = await prisma.coursClasse.upsert({
      where: { coursId_classeId: { coursId: coursDemo.id, classeId: classeDemo.id } },
      update: {},
      create: { coursId: coursDemo.id, classeId: classeDemo.id },
    });
    console.log(`✅ CoursClasse démo (${coursDemo.codeCours} × ${classeDemo.codeClasse})`);

    let epreuveDemo = await prisma.epreuve.findFirst({
      where: { coursClasseId: coursClasseDemo.id, type: TypeEpreuve.CC },
    });
    if (!epreuveDemo) {
      epreuveDemo = await prisma.epreuve.create({
        data: { coursClasseId: coursClasseDemo.id, type: TypeEpreuve.CC },
      });
      console.log('✅ Epreuve démo créée (CC)');
    } else {
      console.log('ℹ️  Epreuve démo (CC) déjà existante');
    }

    // 3 étudiants de démonstration, notés sur cette épreuve
    const etudiantsDemo = [
      { email: 'etudiant.demo1@isseg.local', nom: 'Démo', prenom: 'Un', matricule: 'ISSEG-DEMO-0001', note: 14.5 },
      { email: 'etudiant.demo2@isseg.local', nom: 'Démo', prenom: 'Deux', matricule: 'ISSEG-DEMO-0002', note: 11 },
      { email: 'etudiant.demo3@isseg.local', nom: 'Démo', prenom: 'Trois', matricule: 'ISSEG-DEMO-0003', note: 17 },
    ];
    const demoStudentPasswordHash = await bcrypt.hash(TEST_PASSWORD, 10);

    for (const e of etudiantsDemo) {
      let etudiantUser = await prisma.utilisateur.findUnique({ where: { email: e.email } });
      if (!etudiantUser) {
        etudiantUser = await prisma.utilisateur.create({
          data: {
            nom: e.nom,
            prenom: e.prenom,
            email: e.email,
            motDePasseHash: demoStudentPasswordHash,
            estActif: true,
            loginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: null,
          },
        });
        console.log(`✅ Utilisateur étudiant démo créé: ${e.email}`);
      }

      const etudiantDemo = await prisma.etudiant.upsert({
        where: { userId: etudiantUser.id },
        update: {},
        create: {
          userId: etudiantUser.id,
          matriculeUnique: e.matricule,
          dateNaissance: new Date('2003-01-01'),
        },
      });

      const inscriptionDemo = await prisma.inscription.upsert({
        where: { etudiantId_anneeId: { etudiantId: etudiantDemo.id, anneeId: anneeDemo.id } },
        update: {},
        create: {
          etudiantId: etudiantDemo.id,
          classeId: classeDemo.id,
          anneeId: anneeDemo.id,
          estActive: true,
        },
      });

      await prisma.noteEtudiant.upsert({
        where: {
          epreuveId_inscriptionId: { epreuveId: epreuveDemo.id, inscriptionId: inscriptionDemo.id },
        },
        update: {},
        create: {
          epreuveId: epreuveDemo.id,
          inscriptionId: inscriptionDemo.id,
          noteBrute: e.note,
        },
      });
      console.log(`✅ NoteEtudiant démo: ${e.matricule} → ${e.note}/20`);
    }
  }

  console.log('🎉 Seed completed successfully!');
}

// Garde d'exécution : ne lance le seed que si ce fichier est exécuté
// directement (`pnpm seed`) — évite de déclencher main() (qui exige
// ADMIN_EMAIL/ADMIN_PASSWORD et écrit en base) quand seed.spec.ts importe
// TEST_ROLES/AUTH_ONLY_ROLES/TEST_PERMISSIONS pour un test unitaire pur.
if (require.main === module) {
  main()
    .catch((e) => {
      console.error('❌ Seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
