/**
 * Configuration Jest — TESTS D'INTÉGRATION (base Neon isseg_test uniquement).
 * Cible : fichiers *.integration-spec.ts.
 *
 * `setupFiles` charge et valide TEST_DATABASE_URL (garde-fou anti-isseg) AVANT
 * tout test. Exécution en série (--runInBand via le script) pour les tests de
 * concurrence et pour éviter les collisions de fixtures.
 */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '.*\\.integration-spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['reflect-metadata', '<rootDir>/test/load-test-env.js'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: '<rootDir>/tsconfig.json', isolatedModules: true },
    ],
  },
  testTimeout: 60000,
  clearMocks: true,
};
