/**
 * Configuration ESLint de l'application web.
 *
 * Complète la configuration partagée de la racine, qui apporte le parseur
 * TypeScript et les règles générales, par le préréglage Next. `core-web-vitals`
 * ajoute les règles React, les règles des hooks et les contrôles propres à
 * Next (balises `<img>`, liens internes, imports de polices).
 */
module.exports = {
  extends: ['next/core-web-vitals'],
};
