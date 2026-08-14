/**
 * Configuration Jest — TESTS UNITAIRES (aucune base de données).
 * Cible : fichiers *.spec.ts (les *.integration-spec.ts sont exclus car
 * leur nom ne se termine pas par « .spec.ts »).
 */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['reflect-metadata'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: '<rootDir>/tsconfig.json', isolatedModules: true },
    ],
  },
  clearMocks: true,
};
