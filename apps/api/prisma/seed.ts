import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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
