import { PrismaClient } from '@prisma/client';
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
