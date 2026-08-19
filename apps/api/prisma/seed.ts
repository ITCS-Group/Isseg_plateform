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
const TEST_ROLES = [
  { nomRole: 'SCOLARITE', nom: 'Scolarité', prenom: 'Test' },
  { nomRole: 'ENSEIGNANT', nom: 'Enseignant', prenom: 'Test' },
  { nomRole: 'CHEF_DEPARTEMENT', nom: 'Chef Département', prenom: 'Test' },
  { nomRole: 'RESPONSABLE_PEDAGOGIQUE', nom: 'Responsable Pédagogique', prenom: 'Test' },
];

// Permissions minimales, alignées sur les @Roles() déjà en place :
// - SCOLARITE gère seule le cycle de vie d'un dossier d'inscription
//   (submit/start-processing/register/reject sur registration.controller.ts).
// - ENSEIGNANT et RESPONSABLE_PEDAGOGIQUE peuvent créer/modifier
//   (cours-classe, épreuve, note-etudiant) ; CHEF_DEPARTEMENT n'a
//   aujourd'hui que la lecture sur ces 3 ressources dans le code.
// Note : aucun controller n'utilise encore @Permissions() (RBAC actuel =
// @Roles() seul) — ces lignes préparent la donnée pour un futur usage,
// sans changer le comportement des guards existants.
const TEST_PERMISSIONS: Array<{
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
    roles: ['ENSEIGNANT', 'CHEF_DEPARTEMENT', 'RESPONSABLE_PEDAGOGIQUE'],
  },
  {
    nomPermission: 'MANAGE_PEDAGOGIE',
    description: 'Créer/modifier les cours-classes, épreuves et notes des étudiants',
    roles: ['ENSEIGNANT', 'RESPONSABLE_PEDAGOGIQUE'],
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

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
