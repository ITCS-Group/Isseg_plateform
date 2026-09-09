/**
 * Point d'entrée ESLint du monorepo. La configuration réelle vit dans
 * packages/config/eslint pour être partagée ; elle est référencée par chemin
 * relatif afin de rester résolvable depuis n'importe quel workspace.
 */
module.exports = {
  root: true,
  extends: ['./packages/config/eslint/index.js'],
};
