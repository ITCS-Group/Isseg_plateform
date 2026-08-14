import { PrismaClient } from '@prisma/client';

/**
 * Fabrique un PrismaClient connecté EXCLUSIVEMENT à isseg_test via
 * TEST_DATABASE_URL. Double garde-fou (le setupFile a déjà validé, on revérifie
 * ici avant toute écriture).
 */
export function createTestPrisma(): PrismaClient {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL manquant — refus de créer un client de test.');
  }
  const parsed = new URL(url);
  if (parsed.pathname !== '/isseg_test') {
    throw new Error(`Base de test interdite (${parsed.pathname}) — seule isseg_test est permise.`);
  }
  return new PrismaClient({ datasources: { db: { url } } });
}

/**
 * Vide toutes les tables métier de isseg_test (hors _prisma_migrations),
 * en CASCADE, pour repartir d'un état propre entre tests.
 */
export async function truncateAll(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"${r.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

/**
 * Réinitialise la séquence globale des matricules à 1 (déterminisme des tests).
 * TRUNCATE ne réinitialise pas cette séquence autonome.
 */
export async function resetMatriculeSequence(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE matricule_global_seq RESTART WITH 1`);
}

/** Lit la valeur courante de la séquence (last_value, is_called). */
export async function readMatriculeSeq(
  prisma: PrismaClient,
): Promise<{ lastValue: number; isCalled: boolean }> {
  const rows = await prisma.$queryRawUnsafe<Array<{ last_value: bigint; is_called: boolean }>>(
    `SELECT last_value, is_called FROM matricule_global_seq`,
  );
  return { lastValue: Number(rows[0].last_value), isCalled: rows[0].is_called };
}
