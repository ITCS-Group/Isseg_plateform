/**
 * setupFile Jest (intégration) : charge TEST_DATABASE_URL depuis le .env racine
 * et applique un GARDE-FOU de sécurité.
 *
 * - N'utilise JAMAIS DATABASE_URL.
 * - Refuse de démarrer si la base cible n'est pas exactement « isseg_test ».
 * - Refuse le endpoint pooler (doit être la connexion DIRECTE Neon).
 *
 * Aucune dépendance externe : parsing manuel du fichier .env.
 */
const fs = require('fs');
const path = require('path');

function readEnvValue(key) {
  const envPath = path.resolve(__dirname, '../../../.env'); // racine du monorepo
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) !== key) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    return value;
  }
  return undefined;
}

const url = process.env.TEST_DATABASE_URL || readEnvValue('TEST_DATABASE_URL');

if (!url) {
  throw new Error('[TESTS] TEST_DATABASE_URL introuvable (ni env, ni .env racine).');
}

const parsed = new URL(url);

// Garde-fou 1 : la base DOIT être isseg_test (jamais isseg / prod-dev).
if (parsed.pathname !== '/isseg_test') {
  throw new Error(
    `[TESTS] Base cible interdite : ${parsed.pathname}. Seule « /isseg_test » est autorisée.`,
  );
}

// Garde-fou 2 : connexion DIRECTE Neon exigée (pas le pooler PgBouncer).
if (parsed.host.includes('-pooler')) {
  throw new Error(
    '[TESTS] TEST_DATABASE_URL utilise le pooler ; la connexion DIRECTE Neon est requise.',
  );
}

process.env.TEST_DATABASE_URL = url;
