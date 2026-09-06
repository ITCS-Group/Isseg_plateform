# BACK-07 — Révocation des refresh tokens

Chantier issu d'une anomalie découverte par BACK-06 et volontairement laissée non corrigée par
son agent, dont le périmètre était strictement la couverture de tests.

**Statut : planifié, non implémenté.** Ce document est à valider avant de lancer l'agent.

---

## 1. Anomalie

`UsersService.remove()` et `UsersService.changePassword()` ne révoquent pas les refresh tokens
actifs de l'utilisateur. Les deux portent un `TODO` explicite, lignes 134 et 150 de
`apps/api/src/identity/users/users.service.ts`.

Conséquence concrète :

| Action administrateur | Effet attendu | Effet réel |
|---|---|---|
| Désactiver un compte | les sessions ouvertes tombent | les refresh tokens restent valides |
| Changer un mot de passe | les sessions ouvertes tombent | les refresh tokens restent valides |

Un compte désactivé ou dont le mot de passe vient d'être changé conserve donc jusqu'à 7 jours
la capacité d'obtenir de nouveaux access tokens, tant que son refresh token n'expire pas.

## 2. Ce qui existe déjà et n'est pas à réinventer

L'inspection du code montre que l'essentiel de la mécanique est en place. BACK-07 est un
chantier de branchement, pas de conception.

- `AuthService.refresh()` **rejette déjà** un token porteur de `isRevoked = true`
  (`auth.service.ts:282`). Aucune modification n'est nécessaire côté auth.
- `AuthService.logout()` (`auth.service.ts:403`) contient **déjà** exactement le motif de
  révocation en masse recherché, dans une transaction :
  `refreshToken.updateMany({ where: { utilisateurId, isRevoked: false }, data: { isRevoked: true } })`.
- Le modèle `RefreshToken` possède déjà `isRevoked` et un index sur `utilisateurId`.
  **Aucune migration Prisma n'est nécessaire.**
- Les tests sont **déjà écrits** par BACK-06, en `it.skip`, et fixent la forme attendue de
  l'appel. L'implémentation doit les satisfaire tels quels.

`UsersService` n'injecte aujourd'hui que `PrismaService`. La révocation doit donc s'écrire
directement via Prisma, **et non** en injectant `AuthService` : `AuthModule` dépend déjà de
`UsersModule`, l'injection inverse créerait une dépendance circulaire.

## 3. Périmètre fermé

**Fichiers autorisés — aucun autre**
```
apps/api/src/identity/users/users.service.ts
apps/api/src/identity/users/users.service.spec.ts              ← retrait des 2 .skip
apps/api/src/identity/users/users.service.integration-spec.ts  ← retrait des 2 .skip
```

**Fichiers interdits — explicitement**
- `apps/api/src/auth/**` (la vérification de révocation y fonctionne déjà, en lecture seule)
- `apps/api/prisma/**` (aucune migration, aucun changement de schéma)
- `apps/api/src/identity/{roles,permissions}/**` (périmètre de BACK-02-B1)
- `apps/api/src/common/**`, tout `apps/web/**`, tout `packages/**`
- `.env`, `docker-compose.yml`, et **toute variable `DATABASE_URL` / `TEST_DATABASE_URL`**

**Branche** : `fix/refresh-token-revocation`, créée depuis `origin/main` à jour.

## 4. Travail attendu

1. Dans `remove()` : révoquer les refresh tokens actifs avant ou dans la même transaction que
   le passage de `estActif` à `false`, puis retirer le `TODO`.
2. Dans `changePassword()` : idem autour de la mise à jour de `motDePasseHash`.
3. Retirer les 4 `it.skip` (2 unitaires, 2 d'intégration) et le commentaire « BLOQUÉ: divergence »
   qui les accompagne.
4. Ajouter un test d'intégration de bout en bout, **le seul vraiment nouveau** : après
   `remove()` puis après `changePassword()`, un refresh token émis avant l'opération ne doit
   plus permettre d'obtenir un access token via `AuthService.refresh()`. C'est ce test qui
   prouve la correction du point de vue de l'attaquant, pas seulement du point de vue de la table.

L'atomicité compte : si la révocation et la mise à jour du compte ne sont pas dans la même
transaction, un échec partiel laisse un compte désactivé avec des sessions vivantes. Utiliser
`$transaction`, comme le fait déjà `AuthService.logout()`.

## 5. Critères de validation

| Contrôle | Attendu |
|---|---|
| `tsc --noEmit` | exit 0 |
| Tests unitaires | tous PASS, **0 skip** |
| Tests d'intégration | tous PASS, **0 skip** |
| `git diff --name-only` | exactement les 3 fichiers autorisés |
| Migration Prisma | aucune |

Le passage de 2 skips à 0 est le marqueur de fin de chantier.

## 6. Conditions d'arrêt

L'agent s'arrête et rapporte, sans décider seul, si :
- la révocation exige de modifier `auth.service.ts` (elle ne devrait pas) ;
- un autre appelant de `remove()` ou `changePassword()` dépend du maintien des sessions ;
- il découvre d'autres chemins de code laissant des sessions actives, par exemple une
  suppression physique d'utilisateur ou une modification d'email. Ces cas sortent du périmètre
  et relèvent d'un chantier distinct.

## 7. Position dans la séquence

L'inspection des listes de fichiers donne la réponse suivante.

| Chantier | Fichiers en commun avec BACK-07 | Conclusion |
|---|---|---|
| **BACK-02-B1** | aucun. B1 couvre `roles`, `permissions`, `cours-classe`, `note-etudiant`, et interdit déjà `users.*` | **parallélisable** |
| **BACK-02-B2** | aucun, chantier purement frontend | parallélisable |
| **BACK-01** | `users.service.ts`, inclus dans les 17 services via `identity ×3` | **conflit certain** |

BACK-07 peut donc être lancé **en parallèle de BACK-02-B1**, et doit être **mergé avant que
BACK-01 ne démarre**. Il ne dépend d'aucune décision en attente : ni DEC-01, ni DEC-02, ni DEC-05
ne le bloquent.

```
main (BACK-06 + BACK-02-A mergés)
  ├── BACK-07      fix/refresh-token-revocation      [aucun gate]
  └── BACK-02-B1   feat/pagination-breaking-backend  [gate DEC-02]
         ↓
      BACK-02-B2   [gate B1 mergé]
         ↓
      BACK-01      [gate DEC-01 + BACK-07 mergé]
```

## 8. Contrainte d'exécution des tests

Un seul agent à la fois peut lancer la suite d'intégration : elle partage la base `isseg_test`
et chaque suite appelle `truncateAll`. Deux agents en parallèle se détruisent mutuellement les
données et produisent de faux échecs de clé étrangère, constatés en vague 1. Si BACK-07 et
BACK-02-B1 tournent ensemble, leurs phases de tests d'intégration doivent être sérialisées, ou
chaque agent doit recevoir sa propre base.

Base de test : PostgreSQL local `isseg_test` sur le conteneur `isseg-postgres`. **Neon n'est
plus utilisé.** `DATABASE_URL` reste inchangé et hors périmètre de tout agent.
