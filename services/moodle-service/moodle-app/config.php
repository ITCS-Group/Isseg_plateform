<?php
// Configuration Moodle — écrite à la main pour ISSEG, à partir de
// config-dist.php (source officielle Moodle 4.5, PAS le
// config.docker-template.php de moodlehq/moodle-docker, qui est taillé
// pour leur CI : debug affiché, politique de mot de passe désactivée,
// SMTP mocké, Behat/PHPUnit — rien de tout ça n'a sa place ici).
//
// Toutes les valeurs de connexion viennent des variables d'environnement
// du conteneur (voir docker-compose.yml + .env, jamais commité).

unset($CFG);
global $CFG;
$CFG = new stdClass();

// ── 1. Base de données ──────────────────────────────────────────────────
$CFG->dbtype    = 'pgsql';
$CFG->dblibrary = 'native';
$CFG->dbhost    = getenv('MOODLE_DB_HOST');
$CFG->dbname    = getenv('MOODLE_DB_NAME');
$CFG->dbuser    = getenv('MOODLE_DB_USER');
$CFG->dbpass    = getenv('MOODLE_DB_PASSWORD');
$CFG->prefix    = 'mdl_';
$CFG->dboptions = [
    'dbport' => getenv('MOODLE_DB_PORT') ?: '5432',
    // Neon exige une connexion chiffrée. 'require' = SSL forcé sans
    // vérification de la CA (valeur officiellement documentée dans
    // config-dist.php, section dboptions/ssl). PAS de dbcollation ici :
    // ce réglage est spécifique à MySQL, config-dist.php dit
    // explicitement de le retirer pour les autres bases.
    'ssl' => 'require',
];

// ── 2. Adresse du site ──────────────────────────────────────────────────
// URL complète (avec schéma et port) — voir MOODLE_SITE_URL dans .env.example.
$CFG->wwwroot = getenv('MOODLE_SITE_URL');

// ── 3. Emplacement des fichiers de données ──────────────────────────────
// Hors du docroot (/var/www/html) par exigence de sécurité Moodle —
// volume Docker dédié, voir docker-compose.yml.
$CFG->dataroot = '/var/www/moodledata';
$CFG->routerconfigured = false; // valeur par défaut Moodle 4.5

// ── 4. Permissions des nouveaux répertoires ─────────────────────────────
$CFG->directorypermissions = 02777; // valeur par défaut officielle

require_once(__DIR__ . '/lib/setup.php'); // Do not edit

// There is no php closing tag in this file, it is intentional because it
// prevents trailing whitespace problems!
