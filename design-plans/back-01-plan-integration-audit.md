# BACK-01 — Plan d'intégration des 39 mutations

**Statut : plan, non implémenté.** Aucun service métier n'est modifié à ce stade.

Ce document complète `backend-implementation-plan.md`. Il fige, mutation par mutation, ce qui
sera écrit dans `AuditLog`, d'où viendra l'acteur, et quelle transaction portera l'écriture.

Base : branche `feat/back-01-business-audit-log`, partie de `22ffb7d`. `AuditService`,
`AuditModule` et la migration `20260907203710_add_business_audit_actions` sont déjà en place.

---

## 1. Constats transverses

Trois faits, relevés dans le code et non supposés, déterminent la charge réelle.

**L'acteur est presque toujours absent.** Sur 39 mutations, **4 seulement** reçoivent déjà un
acteur : `abandon.signaler(actorId)`, `abandon.deciderReprise(actorId)`,
`requete.create(utilisateurId)` et `requete.cloturer(user)`. Les 35 autres devront le recevoir.

**Huit contrôleurs sur seize n'utilisent pas `CurrentUser`.** Ceux d'`users`, `roles`,
`permissions`, `ouvrages`, `abonnes`, `epreuve`, `postes` et `support-it/cours` devront
l'introduire. Les huit autres l'utilisent déjà, mais ne le transmettent pas toujours au service.

**Vingt-neuf mutations sur trente-neuf n'ont pas de transaction.** Ajouter l'écriture d'audit les
fait passer à deux écritures : sans transaction, une mutation réussie pourrait rester sans trace.
Ces 29 devront donc être enveloppées dans `$transaction`. Ce n'est pas un élargissement de
périmètre, c'est la condition pour respecter DEC-01-D, et cela reste limité aux 39 mutations
validées. Les 10 restantes ont déjà leur transaction et n'ont qu'à passer `tx` à `record()`.

### Conventions retenues pour tout le plan

- `entityId` d'un CREATE = identifiant de la ligne créée, lu sur le résultat **dans** la transaction.
- `entityId` d'un DELETE = identifiant capturé **avant** la suppression, jamais relu après.
- `details` reste minimal et ne contient jamais de valeur sensible. `AuditService` masque déjà les
  clés sensibles de façon récursive, mais ce filet ne dispense pas d'être sobre à l'appel.
- Pour une modification, `details` liste les **noms** des champs modifiés, pas leurs valeurs, sauf
  quand la valeur est elle-même le fait métier à tracer (un changement de statut, par exemple).

---

## 2. Lot 1 — Identity / Utilisateurs (6 mutations)

Le lot le plus sensible, et celui qui justifie le chantier : savoir qui a agi sur quel compte.
`users.controller.ts` devra introduire `@CurrentUser()` et les 6 signatures de service devront
recevoir l'acteur.

| Méthode | Action | Entity | Source `entityId` | Source acteur | Transaction | `details` | Exclu de `details` |
|---|---|---|---|---|---|---|---|
| `create` | CREATE | Utilisateur | `id` du résultat | `CurrentUser` à introduire | à introduire | `email`, `nom`, `prenom`, `estActif` | `motDePasse`, `motDePasseHash` |
| `update` | UPDATE | Utilisateur | paramètre `id` | `CurrentUser` à introduire | à introduire | noms des champs modifiés | toute valeur de champ sensible |
| `remove` | DELETE | Utilisateur | paramètre `id` | `CurrentUser` à introduire | **existante** (BACK-07) | `refreshTokensRevoques` (compte) | — |
| `changePassword` | UPDATE | Utilisateur | paramètre `id` | `CurrentUser` à introduire | **existante** (BACK-07) | `motDePasseModifie: true`, `refreshTokensRevoques` | le mot de passe et son hash, sous toute forme |
| `assignRole` | CREATE | Utilisateur | paramètre `userId` | `CurrentUser` à introduire | à introduire | `roleId`, `roleNom` | — |
| `removeRole` | DELETE | Utilisateur | paramètre `userId` | `CurrentUser` à introduire | à introduire | `roleId`, `roleNom` | — |

`assignRole` et `removeRole` prennent `Utilisateur` comme entité cible, et non `UtilisateurRole` :
la question à laquelle l'audit doit répondre est « qu'est-il arrivé à ce compte », et le rôle est
le détail de l'action. Si vous préférez la table de liaison comme cible, il faut le dire avant
l'implémentation.

**Tests** — `users.service.spec.ts` : les 6 mutations reçoivent un acteur, donc toutes les
assertions d'appel existantes changent de signature. Ajouter un cas par mutation vérifiant
l'écriture d'audit, plus un cas prouvant qu'aucun mot de passe n'atteint `AuditLog`.
`users.service.integration-spec.ts` : vérifier en base l'entrée produite par `remove` et
`changePassword`, et l'annulation conjointe en cas d'échec.

---

## 3. Lot 2 — Identity / Rôles et Permissions (8 mutations)

Mêmes contraintes : les deux contrôleurs ignorent `CurrentUser`, aucune transaction n'existe.

| Méthode | Action | Entity | Source `entityId` | Transaction | `details` |
|---|---|---|---|---|---|
| `roles.create` | CREATE | Role | `id` du résultat | à introduire | `nomRole` |
| `roles.update` | UPDATE | Role | paramètre `id` | à introduire | noms des champs modifiés |
| `roles.remove` | DELETE | Role | paramètre `id` | à introduire | `nomRole` capturé avant suppression |
| `roles.assignPermission` | CREATE | Role | paramètre `roleId` | à introduire | `permissionId`, `nomPermission` |
| `roles.removePermission` | DELETE | Role | paramètre `roleId` | à introduire | `permissionId`, `nomPermission` |
| `permissions.create` | CREATE | Permission | `id` du résultat | à introduire | `nomPermission` |
| `permissions.update` | UPDATE | Permission | paramètre `id` | à introduire | noms des champs modifiés |
| `permissions.remove` | DELETE | Permission | paramètre `id` | à introduire | `nomPermission` capturé avant |

Acteur : `CurrentUser` à introduire dans les deux contrôleurs, pour les 8.

**Tests** — Les specs unitaires et d'intégration de `roles` et `permissions`, créées par BACK-06,
sont à adapter aux nouvelles signatures et à compléter d'un cas d'audit par mutation.

---

## 4. Lot 3 — Bibliothèque (8 mutations)

| Méthode | Action | Entity | Source `entityId` | Source acteur | Transaction |
|---|---|---|---|---|---|
| `ouvrage.create` | CREATE | Ouvrage | `id` du résultat | `CurrentUser` à introduire | à introduire |
| `ouvrage.update` | UPDATE | Ouvrage | paramètre `id` | `CurrentUser` à introduire | à introduire |
| `ouvrage.remove` | DELETE | Ouvrage | paramètre `id` | `CurrentUser` à introduire | à introduire |
| `emprunt.create` | CREATE | Emprunt | `id` du résultat | contrôleur l'a, à propager | **existante** |
| `emprunt.retour` | UPDATE | Emprunt | paramètre `id` | contrôleur l'a, à propager | **existante** |
| `document-academique.create` | CREATE | DocumentAcademique | `id` du résultat | contrôleur l'a, à propager | à introduire |
| `document-academique.update` | UPDATE | DocumentAcademique | paramètre `id` | contrôleur l'a, à propager | à introduire |
| `abonne.create` | CREATE | Abonne | `id` du résultat | `CurrentUser` à introduire | à introduire |

`details` : `cote` et `titre` pour un ouvrage, `ouvrageId` et `emprunteurId` pour un emprunt,
`type` et `titre` pour un document, `type` d'abonné. Aucune donnée personnelle au-delà des
identifiants déjà présents dans les tables.

---

## 5. Lot 4 — Pédagogie (6 mutations)

| Méthode | Action | Entity | Source `entityId` | Source acteur | Transaction |
|---|---|---|---|---|---|
| `cours-classe.create` | CREATE | CoursClasse | `id` du résultat | contrôleur l'a, à propager | à introduire |
| `cours-classe.remove` | DELETE | CoursClasse | paramètre `id` | contrôleur l'a, à propager | à introduire |
| `epreuve.create` | CREATE | Epreuve | `id` du résultat | `CurrentUser` à introduire | à introduire |
| `epreuve.remove` | DELETE | Epreuve | paramètre `id` | `CurrentUser` à introduire | à introduire |
| `note-etudiant.create` | CREATE | NoteEtudiant | `id` du résultat | contrôleur l'a, à propager | à introduire |
| `note-etudiant.remove` | DELETE | NoteEtudiant | paramètre `id` | contrôleur l'a, à propager | à introduire |

**`note-etudiant.update` reste exclu** et conserve `NoteEtudiantHistory` comme seule traçabilité,
conformément à DEC-03. Le service continue donc d'écrire cet historique sans changement.

`details` : `coursClasseId` et `classeId` pour un cours-classe, `type` et `coursClasseId` pour une
épreuve, `epreuveId` et `inscriptionId` pour une note. **La valeur de la note n'est pas
journalisée** dans l'audit générique : c'est le rôle de `NoteEtudiantHistory`.

---

## 6. Lot 5 — Scolarité / Abandon (3 mutations)

Le lot le plus simple : les trois mutations sont déjà transactionnelles, et deux reçoivent déjà
l'acteur.

| Méthode | Action | Entity | Source `entityId` | Source acteur | Transaction |
|---|---|---|---|---|---|
| `signaler` | UPDATE | Abandon | `id` du résultat | **déjà présent** (`actorId`) | **existante** |
| `demanderReprise` | UPDATE | Abandon | paramètre `id` | à propager | **existante** |
| `deciderReprise` | UPDATE | Abandon | paramètre `id` | **déjà présent** (`actorId`) | **existante** |

`details` : `statutAvant` et `statutApres`, la transition étant ici le fait métier à tracer.

`RegistrationService.applyTransition` **reste exclu** et conserve `RegistrationHistory`.

---

## 7. Lot 6 — Support informatique (8 mutations)

| Méthode | Action | Entity | Source `entityId` | Source acteur | Transaction |
|---|---|---|---|---|---|
| `requete.create` | CREATE | Requete | `id` du résultat | **déjà présent** (`utilisateurId`) | à introduire |
| `requete.cloturer` | UPDATE | Requete | paramètre `id` | **déjà présent** (`user`) | à introduire |
| `poste.create` | CREATE | Poste | `id` du résultat | `CurrentUser` à introduire | à introduire |
| `poste.updateStatut` | UPDATE | Poste | paramètre `id` | `CurrentUser` à introduire | à introduire |
| `inscription.enroll` | CREATE | InscriptionCoursSupportIT | `id` du résultat | à propager, **≠ `participantId`** | à introduire |
| `inscription.evaluer` | UPDATE | InscriptionCoursSupportIT | paramètre `id` | à propager | **existante** |
| `cours.create` | CREATE | CoursSupportIT | `id` du résultat | `CurrentUser` à introduire | à introduire |
| `intervention.create` | CREATE | Intervention | `id` du résultat | contrôleur l'a, à propager | **existante** |

Piège à éviter sur `inscription.enroll` : son paramètre `participantId` désigne la personne
inscrite, **pas** l'auteur de l'inscription. Un secrétariat peut inscrire un tiers. Confondre les
deux produirait un audit faux, ce qui est pire qu'un audit absent.

`details` : `statutAvant`/`statutApres` pour un changement de statut de poste ou de requête,
`coursId` et `participantId` pour une inscription, `requeteId` pour une intervention.

---

## 8. Ordre d'exécution et points d'arrêt

Un lot par étape, avec arrêt et rapport après chacun.

```
Lot 1  Identity / Utilisateurs        6 mutations   [le plus sensible, sert de patron]
Lot 2  Identity / Rôles + Permissions 8
Lot 3  Bibliothèque                   8
Lot 4  Pédagogie                      6
Lot 5  Scolarité / Abandon            3
Lot 6  Support informatique           8
                                     ──
                                     39
```

Le lot 1 passe en premier parce qu'il est le plus exposé et qu'il fixe le patron que les cinq
autres reprendront : introduction de `CurrentUser`, propagation de l'acteur, enveloppe
transactionnelle, forme des `details`.

Pour chaque lot : `tsc --noEmit`, tests ciblés, puis suite complète de non-régression. Les tests
d'intégration s'exécutent sous verrou, un seul agent à la fois sur `isseg_test`.

## 9. Risques

Les signatures publiques de service changent sur 35 mutations, donc **toutes les specs unitaires
existantes de ces services devront être adaptées**. C'est mécanique mais volumineux, et c'est là
que se cache le risque de casser un test par inadvertance plutôt que de le mettre à jour.

Envelopper 29 mutations dans une transaction modifie leur comportement en cas d'erreur : une
opération qui échouait partiellement échouera désormais entièrement. C'est le but recherché, mais
un test existant qui s'appuyait sur un état partiel changera de résultat, et il faudra le traiter
comme une découverte à signaler, pas comme un test à corriger pour qu'il passe.

Enfin, un audit dont l'acteur serait mal câblé est pire qu'une absence d'audit, puisqu'il
désignerait la mauvaise personne. D'où la vigilance explicite sur `inscription.enroll`.
