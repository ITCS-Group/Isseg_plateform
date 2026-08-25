# Installation de l'application Moodle (LMS)

Ce document couvre l'installation de **l'application Moodle elle-même**
(le LMS) — à ne pas confondre avec `services/moodle-service/`, notre
microservice NestJS de synchronisation qui s'y connectera plus tard. Les
fichiers vivent dans `services/moodle-service/moodle-app/` pour rester
groupés logiquement, sans mélanger le code du microservice avec l'infra de
l'application Moodle.

Chantier purement infrastructure : aucune donnée métier, aucun mapping
Moodle↔ISSEG, aucun cours ni donnée de test ne sont créés ici. L'objectif est
une installation Moodle **vide et fonctionnelle**, prête à être configurée
plus tard une fois les entretiens Moodle réalisés.

## Prérequis vérifiés

- **Version Moodle** : 4.5 (LTS) — support sécurité jusqu'à octobre 2027.
  (La prochaine LTS, 5.3, sort le 5 octobre 2026 avec PostgreSQL 16 minimum —
  à réévaluer si ce chantier est repris après cette date.)
- **PostgreSQL** : version 13 minimum (Moodle 4.5). Neon supporte largement
  cette plage de versions.
- **Encodage** : UTF8 (standard Neon, rien à configurer côté base).
- **Extensions PostgreSQL** : **aucune n'est requise par Moodle**
  (vérifié sur la documentation officielle). `pgcrypto` n'est pas un
  prérequis — Neon l'autorise de toute façon si un besoin futur apparaît.

## Pourquoi ce n'est pas un simple `docker compose up` avec une image "tout-en-un"

Deux fausses pistes explorées et abandonnées avant l'approche actuelle —
gardées ici pour ne pas les retenter sans raison :

1. **`bitnami/moodle`** (image applicative complète, un seul conteneur) :
   **n'est plus disponible gratuitement sur Docker Hub depuis 2025**
   (passée en abonnement commercial "Bitnami Secure Images"). Une version de
   secours existe (`bitnamilegacy/moodle:4.5.4`) mais Bitnami la qualifie
   eux-mêmes de dépréciée : *"no longer updated (...) may be removed in the
   future"* — pas une base saine pour une infra censée durer.

2. **`moodlehq/moodle-docker`** (l'outillage CI officiel de Moodle HQ) :
   PostgreSQL y est bien supporté et documenté (`MOODLE_DOCKER_DB=pgsql`),
   mais en y regardant de plus près (`config.docker-template.php` du
   projet), leur `$CFG->dbhost` est **codé en dur à `'db'`** — aucun
   mécanisme prévu pour pointer vers une base externe comme Neon. Et ce
   template est taillé pour leur suite de tests (Behat/PHPUnit), pas pour
   une vraie installation : `debugdisplay=1`, `passwordpolicy=0`,
   identifiants de dev en dur, SMTP mocké (`mailpit`).

**Approche retenue** : l'image `moodlehq/moodle-php-apache` **seule**
(PHP + Apache officiels Moodle HQ, gratuite et pérenne — c'est la même image
que moodle-docker utilise en interne, sans tout son outillage CI autour) +
le code source Moodle cloné séparément + **notre propre `config.php`**,
écrit à la main à partir du vrai `config-dist.php` officiel de Moodle (pas
du template CI), sans rien de Behat/PHPUnit/debug/SMTP mocké.

Concrètement, ça veut dire une étape en plus par rapport à un conteneur
"tout-en-un" : **cloner le code source Moodle sur le disque avant de
démarrer le conteneur** (voir étape 3 ci-dessous) — c'est normal, ce n'est
pas une erreur de manipulation.

## 1. Récupérer les identifiants de connexion à `moodleDb` sur Neon

Dans la console Neon, sur le projet contenant `moodleDb` :

1. Onglet **Connection Details** (ou **Dashboard**).
2. Sélectionner la branche/rôle voulu, puis **impérativement** choisir le
   mode **Direct connection** (PAS "Pooled connection") — le pooler
   PgBouncer casse les connexions applicatives persistantes que Moodle
   ouvre au démarrage. Le host direct ne contient jamais `-pooler` dans son
   nom (ex. `ep-xxxxxxxx.c-2.eu-west-2.aws.neon.tech`, à comparer avec
   `ep-xxxxxxxx-pooler.c-2.eu-west-2.aws.neon.tech` pour le pooler).
3. Noter host, port (5432), nom de base (`moodleDb`), utilisateur, mot de
   passe — **séparément**, pas la chaîne de connexion complète collée telle
   quelle (`MOODLE_DB_HOST` ne doit contenir QUE le nom d'hôte, sans
   `postgresql://`, sans `user:password@`, sans `?sslmode=...`).

## 2. Configurer l'environnement

```bash
cd services/moodle-service/moodle-app
cp .env.example .env
# Éditer .env avec les vraies valeurs récupérées à l'étape 1
```

Ne jamais committer ce `.env` (déjà couvert par la règle générique `.env`
du `.gitignore` racine, vérifié explicitement à ce chemin).

## 3. Cloner le code source Moodle

```bash
cd services/moodle-service/moodle-app
git clone -b MOODLE_405_STABLE https://github.com/moodle/moodle.git moodle-src
```

`moodle-src/` (ou la valeur de `MOODLE_SRC_DIR` dans `.env` si différente)
est **volontairement ignoré par git** (`.gitignore` local à ce dossier) —
c'est ~200 Mo de code dont le vrai dépôt `moodle/moodle` est la source de
vérité, pas nous.

## 4. Lancer le conteneur

```bash
cd services/moodle-service/moodle-app
docker compose up -d
docker compose logs -f moodle
```

Ce conteneur ne fait que servir le code (Apache + PHP) — il ne contient
**aucune logique d'installation automatique** (contrairement à bitnami).
Le site est accessible sur `http://localhost:${MOODLE_APP_PORT:-8090}` mais
affichera une erreur tant que le schéma n'est pas installé (étape suivante).

## 5. Installer le schéma + créer le compte admin (CLI, pas l'assistant web)

`config.php` existe déjà (le nôtre, monté en volume) et pointe vers
`moodleDb` — il ne reste qu'à initialiser le schéma. Le script officiel
`admin/cli/install_database.php` fait les deux en une fois (schéma **et**
compte admin), sans passer par l'assistant web, et sans jamais taper le mot
de passe admin en clair dans une commande :

```bash
cd services/moodle-service/moodle-app
set -a; source .env; set +a
docker compose exec -T -u www-data moodle php admin/cli/install_database.php \
  --agree-license \
  --fullname="ISSEG Moodle" \
  --shortname="ISSEGMoodle" \
  --adminuser="$MOODLE_ADMIN_USERNAME" \
  --adminpass="$MOODLE_ADMIN_PASSWORD" \
  --adminemail="$MOODLE_ADMIN_EMAIL"
```

(`-u www-data` : le script l'exige explicitement — même utilisateur que le
process Apache.)

**Vérification que le schéma est vraiment initialisé** (pas juste que le
conteneur tourne) : une vraie table Moodle doit exister dans `moodleDb`,
ex. `mdl_config` :

```bash
psql "postgresql://<user>:<password>@<host-direct>:5432/moodleDb?sslmode=require" \
  -c "SELECT COUNT(*) FROM mdl_config;"
```

## 6. Confirmer l'accès à l'interface web

`http://localhost:${MOODLE_APP_PORT:-8090}` — connexion avec
`MOODLE_ADMIN_USERNAME` / `MOODLE_ADMIN_PASSWORD`.

## 7. Activer les Web Services REST + générer un token API

Nécessaire pour que `MoodleClientService` (côté `services/moodle-service/`)
puisse s'authentifier plus tard — aucune fonction Moodle précise n'est
appelée à ce stade, seule l'infrastructure d'auth est préparée ici.

1. **Site administration → Advanced features** (Fonctionnalités avancées) :
   cocher **Enable web services** (Activer les services web).
2. **Site administration → Server → Web services → Manage protocols**
   (Gérer les protocoles) : activer **REST protocol**.
3. **Site administration → Server → Web services → External services**
   (Services externes) : soit utiliser un service existant, soit créer un
   service dédié (ex. "ISSEG Sync") — **sans y ajouter de fonction précise
   pour l'instant**, ça attend le mapping de données (entretiens Moodle).
4. Créer un **utilisateur de service dédié** (pas le compte admin
   personnel) avec uniquement la capacité `webservice/rest:use` — pas un
   accès total.
5. **Site administration → Server → Web services → Manage tokens**
   (Gérer les jetons) : créer un token pour cet utilisateur et le service
   choisis à l'étape 3.
6. Reporter ce token dans `services/moodle-service/.env`
   (`MOODLE_API_KEY`) — jamais committé, jamais en dur dans un fichier
   suivi par git.

## Ce qui n'est délibérément PAS fait ici

- Aucun cours, aucune donnée de test créée dans Moodle.
- Aucune fonction de web service précise activée/appelée — l'étape 7
  prépare seulement l'infrastructure d'authentification.
- Aucun mapping de champs Moodle↔ISSEG — attend les entretiens Moodle.
- `services/moodle-service/` (le microservice NestJS) et `apps/worker`
  restent inchangés par ce chantier — c'est un chantier infra pur.
