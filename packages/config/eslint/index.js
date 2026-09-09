/**
 * Configuration ESLint partagée du monorepo ISSEG.
 *
 * Volontairement sans règles « type-aware » : celles-ci exigent
 * `parserOptions.project` et un chargement complet du programme TypeScript,
 * ce qui allonge fortement le temps de lint. Le socle se limite donc aux
 * règles syntaxiques, suffisantes pour attraper la majorité des défauts.
 */
module.exports = {
  // Exclusions déclarées ici plutôt que dans un .eslintignore racine : ESLint 8
  // ne lit ce fichier que depuis le répertoire courant, or chaque workspace
  // lance son propre lint depuis son propre répertoire. Ces motifs suivent la
  // syntaxe .gitignore et s'appliquent donc à n'importe quelle profondeur.
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '.next/',
    '.turbo/',
    'coverage/',
    'generated/',
    '*.d.ts',
    // Code source Moodle récupéré localement (441 Mo, non suivi par Git) : il
    // embarque sa propre configuration ESLint et ses propres plugins.
    'moodle-src/',
  ],
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    // Un identifiant préfixé d'un underscore est une non-utilisation assumée.
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
    ],
  },
  overrides: [
    {
      // TypeScript assure lui-même la résolution des identifiants : `no-undef`
      // y produit des faux positifs sur les types globaux.
      files: ['*.ts', '*.tsx'],
      rules: { 'no-undef': 'off' },
    },
    {
      // Composants React : JSX et globales navigateur.
      files: ['*.tsx', '*.jsx'],
      env: { browser: true },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  ],
};
