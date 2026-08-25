# Installation de l'application Moodle (LMS)

Ce document couvre l'installation de **l'application Moodle elle-même**
(le LMS, via conteneur Docker) — à ne pas confondre avec
`services/moodle-service/`, notre microservice NestJS de synchronisation qui
s'y connectera plus tard. Les fichiers d'installation vivent dans
`services/moodle-service/moodle-app/` pour rester groupés logiquement, sans
mélanger le code du microservice avec l'infra de l'application Moodle.

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
- **Image Docker** : `bitnami/moodle:4.5` (pas d'image officielle
  "clé en main" équivalente maintenue par Moodle HQ — `moodlehq/*` sert à
  leur propre CI/dev, pas à un déploiement applicatif autonome).

### ⚠️ Point de vigilance connu : SSL vers Postgres externe

`bitnami/moodle` a un bug documenté et confirmé par la communauté
([bitnami/containers#65832](https://github.com/bitnami/containers/issues/65832)) :
la connexion SSL vers un Postgres externe (RDS, Neon, etc.) échoue avec
`Permission denied` sur `/root/.postgresql/postgresql.crt`, car le process
Apache du conteneur n'a pas les droits sur ce chemin — même quand aucun
certificat client n'est réellement nécessaire. Contournement déjà appliqué
dans `docker-compose.yml` : `PGSSLCERT=/tmp/postgresql.crt` (chemin
inscriptible) + `PGSSLMODE=require`. Ce sont des variables **libpq
standard** (lues par l'extension PHP `pgsql`), pas des variables
spécifiques à bitnami/moodle — si l'erreur réapparaît malgré tout, c'est le
premier endroit à vérifier.

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
   passe.

## 2. Configurer l'environnement

```bash
cd services/moodle-service/moodle-app
cp .env.example .env
# Éditer .env avec les vraies valeurs récupérées à l'étape 1
```

Ne jamais committer ce `.env` (déjà couvert par la règle générique `.env`
du `.gitignore` racine).

## 3. Lancer le conteneur

```bash
cd services/moodle-service/moodle-app
docker compose up -d
docker compose logs -f moodle   # suivre l'initialisation
```

Avec `MOODLE_USERNAME`/`MOODLE_PASSWORD`/`MOODLE_EMAIL` renseignés dans
`.env`, l'image bitnami **bootstrap automatiquement** l'installation
(création du schéma dans `moodleDb`, compte admin) au premier démarrage —
pas d'assistant web à parcourir manuellement dans ce cas. Pour piloter
l'installation soi-même via l'assistant web classique à la place, ajouter
`MOODLE_SKIP_BOOTSTRAP=yes` dans `.env` avant le premier `docker compose up`,
puis suivre l'assistant sur `http://localhost:${MOODLE_APP_PORT:-8090}`.

Une fois démarré, le site est accessible sur
`http://localhost:${MOODLE_APP_PORT:-8090}` (port 8090 par défaut).

## 4. Se connecter avec le compte admin

Identifiants = `MOODLE_ADMIN_USERNAME` / `MOODLE_ADMIN_PASSWORD` définis
dans `.env`.

## 5. Activer les Web Services + générer un token API

Nécessaire pour que `MoodleClientService` (côté `services/moodle-service/`)
puisse s'authentifier plus tard — aucune fonction Moodle précise n'est
appelée à ce stade, seule l'infrastructure d'auth est préparée ici.

1. **Site administration → Advancé features** (Fonctionnalités avancées) :
   cocher **Enable web services** (Activer les services web).
2. **Site administration → Server → Web services → Manage protocols**
   (Gérer les protocoles) : activer **REST protocol**.
3. **Site administration → Server → Web services → External services**
   (Services externes) : soit utiliser un service existant, soit créer un
   service dédié (ex. "ISSEG Sync") et y ajouter les fonctions nécessaires
   — **à faire plus tard, une fois le mapping de données décidé**, pas
   maintenant.
4. **Site administration → Users → Permissions → Define roles**, ou
   directement sur l'utilisateur : s'assurer que le compte qui portera le
   token a la capacité `webservice/rest:use`.
5. **Site administration → Server → Web services → Manage tokens**
   (Gérer les jetons) : créer un token pour l'utilisateur et le service
   choisis à l'étape 3.
6. Reporter ce token dans `MOODLE_API_KEY` (voir
   `services/moodle-service/.env.example`) — jamais committé.

## Ce qui n'est délibérément PAS fait ici

- Aucun cours, aucune donnée de test créée dans Moodle.
- Aucune fonction de web service précise activée/appelée — l'étape 5
  prépare seulement l'infrastructure d'authentification.
- Aucun mapping de champs Moodle↔ISSEG — attend les entretiens Moodle.
- `services/moodle-service/` (le microservice NestJS) et `apps/worker`
  restent inchangés par ce chantier — c'est un chantier infra pur.
