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

## 5. Installer le schéma + créer le compte admin (CLI, mot de passe jetable)

`config.php` existe déjà (le nôtre, monté en volume) et pointe vers
`moodleDb` — il ne reste qu'à initialiser le schéma. Le script officiel
`admin/cli/install_database.php` fait les deux en une fois (schéma **et**
compte admin), sans passer par l'assistant web.

**Sur le mot de passe utilisé ici** : `install_database.php` n'accepte le
mot de passe admin QUE via l'argument `--adminpass` (vérifié dans son code
source — pas de lecture de variable d'environnement en alternative). Or
tout argument de ligne de commande est visible en clair, pendant
l'exécution du process, via `ps aux` / `/proc/<pid>/cmdline` /
`docker top isseg-moodle-app` — propriété inhérente à `execve()`, aucun
contournement possible côté script. On utilise donc ici un mot de passe
**jetable**, sans rapport avec `MOODLE_ADMIN_PASSWORD` du `.env` — son
exposition transitoire est sans conséquence puisqu'il est immédiatement
remplacé à l'étape 6. Le vrai mot de passe définitif, lui, n'est **jamais**
passé en argument CLI.

```bash
cd services/moodle-service/moodle-app
set -a; source .env; set +a
docker compose exec -T -u www-data moodle php admin/cli/install_database.php \
  --agree-license \
  --fullname="ISSEG Moodle" \
  --shortname="ISSEGMoodle" \
  --adminuser="$MOODLE_ADMIN_USERNAME" \
  --adminpass="TempInstall-$(date +%s)!" \
  --adminemail="$MOODLE_ADMIN_EMAIL"
```

(`-u www-data` : le script l'exige explicitement — même utilisateur que le
process Apache. Le suffixe `$(date +%s)` évite juste de réutiliser un mot
de passe jetable identique d'une installation à l'autre, aucune autre
raison.)

**Vérification que le schéma est vraiment initialisé** (pas juste que le
conteneur tourne) : une vraie table Moodle doit exister dans `moodleDb`,
ex. `mdl_config` :

```bash
psql "postgresql://<user>:<password>@<host-direct>:5432/moodleDb?sslmode=require" \
  -c "SELECT COUNT(*) FROM mdl_config;"
```

## 6. Se connecter et définir le mot de passe définitif

1. `http://localhost:${MOODLE_APP_PORT:-8090}` — connexion avec
   `MOODLE_ADMIN_USERNAME` et le mot de passe **jetable** utilisé à
   l'étape 5 (celui qui apparaît dans la commande, pas `MOODLE_ADMIN_PASSWORD`).
2. **Préférences → Changer le mot de passe** : définir ici
   `MOODLE_ADMIN_PASSWORD` (la vraie valeur du `.env`) — c'est le seul
   endroit où ce mot de passe définitif doit être saisi, jamais dans une
   commande CLI. Le mot de passe jetable devient alors invalide.

### ⚠️ Bug rencontré : nom d'utilisateur en majuscule = connexion impossible

Si `MOODLE_ADMIN_USERNAME` contient une majuscule (ex. `Administrateur`),
**la connexion échouera systématiquement** avec "Invalid login, please try
again", quel que soit le mot de passe — y compris juste après l'install.

**Cause** : `admin/cli/install_database.php` stocke le nom d'utilisateur
**tel quel** dans `mdl_user.username`, sans le forcer en minuscule. Mais
`authenticate_user_login()` (le code de connexion web) met systématiquement
le nom saisi en minuscule avant de comparer en base — une comparaison
stricte, jamais satisfaite si la valeur stockée a une majuscule. Confirmé en
isolant le problème via un script PHP direct (`authenticate_user_login()`
et `password_verify()` appelés hors HTTP) plutôt qu'en devinant depuis le
navigateur.

**Piège en plus** : `admin/cli/reset_password.php --username=Administrateur`
(avec la majuscule) ne trouve pas non plus la ligne existante — et au lieu
d'échouer proprement, **il crée un second compte** avec le nom en minuscule
(`administrateur`), qui n'est pas admin du site. Vérifier `mdl_config` clé
`siteadmins` pour confirmer quel id est le vrai admin avant toute correction.

**Correctif** : utiliser un `MOODLE_ADMIN_USERNAME` **entièrement en
minuscule** dans `.env` dès le départ. Si le problème survient quand même :

```sql
-- Vérifier qui est le vrai admin avant de toucher à quoi que ce soit :
SELECT value FROM mdl_config WHERE name = 'siteadmins';  -- id du vrai admin

-- Corriger la casse du vrai compte (remplacer <id> par l'id ci-dessus) :
UPDATE mdl_user SET username = lower(username) WHERE id = <id>;

-- Si reset_password.php a créé un doublon entre-temps, le supprimer
-- (vérifier d'abord qu'il n'a pas de rôle ni de référence ailleurs) :
DELETE FROM mdl_user WHERE username = '<doublon minuscule>' AND id != <id du vrai admin>;
```

Puis relancer `admin/cli/reset_password.php --username=<username minuscule>
--password=... --ignore-password-policy` pour fixer un mot de passe
fonctionnel, et se reconnecter normalement (étape 6).

## 7. Activer les Web Services REST + générer un token API

Nécessaire pour que `MoodleClientService` (côté `services/moodle-service/`)
puisse s'authentifier plus tard — aucune fonction Moodle précise n'est
appelée à ce stade, seule l'infrastructure d'auth est préparée ici.

### 7.1 Activer les web services et le protocole REST

1. **Site administration → General → Advanced features** : cocher
   **Enable web services**, Save changes.
   Vérification : `SELECT value FROM mdl_config WHERE name = 'enablewebservices';` → `1`.
2. **Site administration → Server → Web services → Manage protocols** :
   cliquer l'icône œil sur la ligne **REST protocol** pour l'activer.
   Vérification : `SELECT value FROM mdl_config WHERE name = 'webserviceprotocols';` → `rest`.

### 7.2 Créer un utilisateur de service dédié (pas le compte admin)

**Site administration → Users → Add a new user.** Un compte séparé, dont le
seul rôle est de porter le token — jamais le compte admin personnel.
Exemple utilisé : username `isseg-sync-service`, nom "ISSEG Sync Service".

### 7.3 Créer un rôle minimal (une seule capacité)

Par défaut, aucun rôle standard n'accorde `webservice/rest:use` — il faut un
rôle dédié plutôt que de sur-attribuer un rôle existant (Manager, etc.) :

1. **Site administration → Users → Permissions → Define roles → Add a new
   role.** "Use role or archetype" = **No role** (on part de zéro, pas d'un
   archétype qui embarquerait d'autres capacités).
2. Short name (ex. `isseg_sync_service`), full name, cocher **System** dans
   "Context types where this role may be assigned".
3. Filtrer les capacités sur `webservice/rest:use`, cocher **Allow**
   uniquement sur celle-ci. Create this role.
4. **Site administration → Users → Permissions → Assign system roles** :
   choisir ce rôle, ajouter l'utilisateur créé en 7.2 dans "Existing users".
   Vérification :
   ```sql
   SELECT u.username, r.shortname, ctx.contextlevel
   FROM mdl_role_assignments ra
   JOIN mdl_user u ON u.id = ra.userid
   JOIN mdl_role r ON r.id = ra.roleid
   JOIN mdl_context ctx ON ctx.id = ra.contextid
   WHERE r.shortname = '<short name du rôle>';
   -- contextlevel doit valoir 10 (CONTEXT_SYSTEM)
   ```

### 7.4 Créer un service externe dédié, sans fonction

**Site administration → Server → Web services → External services → Add.**
Nom (ex. "ISSEG Sync"), short name, cocher **Enabled** et **Authorised users
only**. Create service. Sur l'écran "Add functions to the service" qui
suit : **ne rien ajouter** — "This service has no functions" est l'état
voulu à ce stade (attend le mapping de données, entretiens Moodle).

⚠️ Voir **§ 7.6** : `core_webservice_get_site_info` doit être ajoutée avant
que `MoodleClientService` (y compris `ping()`) puisse fonctionner — "sans
fonction" n'est donc l'état final que tant qu'aucun appel n'est fait.

Puis, depuis la liste des services externes, lien **Authorised users** sur
ce service : ajouter l'utilisateur créé en 7.2 (le déplacer vers
"Authorised users").

### 7.5 Générer le token

**Site administration → Server → Web services → Manage tokens → Create
token.** User = l'utilisateur de service (7.2), Service = le service dédié
(7.4). Laisser "Valid until" à sa valeur par défaut (~1 mois) sauf besoin
contraire — **noter la date d'expiration quelque part** (voir
`STATUT_MODULES.md`), le token n'est affiché qu'une seule fois à l'écran.

Reporter la valeur dans `services/moodle-service/.env` (`MOODLE_API_KEY`) —
jamais committé, jamais en dur dans un fichier suivi par git.

### 7.6 Autoriser `core_webservice_get_site_info` (requis pour `ping()`)

⚠️ **Sans cette étape, tout appel via `MoodleClientService` échoue** —
y compris `ping()`, qui appelle précisément cette fonction. Le service
"ISSEG Sync" créé en 7.4 est délibérément vide de toute fonction ; sans en
autoriser au moins une, Moodle rejette systématiquement le token avec :

```json
{"exception":"webservice_access_exception","errorcode":"accessexception","message":"Access control exception"}
```

**Site administration → Plugins → Web services → External services →
ISSEG Sync → Functions → Add functions.** Chercher et ajouter
**uniquement** `core_webservice_get_site_info` — une fonction
d'introspection pure (version/nom du site, aucune donnée métier), pas une
fonction métier. Vérifier après coup qu'une seule fonction est listée (pas
plus) :

```sql
SELECT sf.functionname
FROM mdl_external_services_functions sf
JOIN mdl_external_services s ON s.id = sf.externalserviceid
WHERE s.shortname = 'isseg_sync';
-- doit retourner exactement 1 ligne : core_webservice_get_site_info
```

**C'est un état applicatif Moodle (une ligne en base), pas versionné par
git.** Si l'instance est réinstallée depuis zéro (étapes 1 à 5 refaites),
cette étape doit être **refaite manuellement** — rien dans le code ou les
migrations ne la recrée automatiquement.

## Ce qui n'est délibérément PAS fait ici

- Aucun cours, aucune donnée de test créée dans Moodle.
- Aucune fonction de web service précise activée/appelée — l'étape 7
  prépare seulement l'infrastructure d'authentification.
- Aucun mapping de champs Moodle↔ISSEG — attend les entretiens Moodle.
- `services/moodle-service/` (le microservice NestJS) et `apps/worker`
  restent inchangés par ce chantier — c'est un chantier infra pur.
