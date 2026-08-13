#!/bin/bash
#
# TEST DE CONCURRENCE B4 — REFRESH TOKEN ROTATION
# ================================================
# Ce script teste la protection contre les race conditions
# en lançant 10 requêtes simultanées avec le même refresh token.
#
# PRÉREQUIS :
# - Le serveur NestJS doit être démarré sur http://localhost:3000
#   Commande : DATABASE_URL="postgresql://abdoul:azerty@localhost:5432/isseg?schema=public" \
#              ADMIN_EMAIL="admin@isseg.local" ADMIN_PASSWORD="Admin123!Secure" \
#              ADMIN_NOM="Administrateur" ADMIN_PRENOM="Système" npm run start:dev
#
# Résultat attendu :
# - Exactement 1 requête réussit (HTTP 200)
# - Toutes les autres échouent (HTTP 401)
# - Exactement 1 nouveau refresh token actif créé en base
#

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "TEST DE CONCURRENCE B4 — REFRESH TOKEN ROTATION"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Vérifier que le serveur est en cours d'exécution
echo "🔍 Vérification préalable : Serveur NestJS..."
if ! nc -z localhost 3000 2>/dev/null; then
  echo "❌ ERREUR : Le serveur NestJS n'est pas démarré sur le port 3000"
  echo ""
  echo "Veuillez démarrer le serveur avec la commande suivante :"
  echo ""
  echo 'DATABASE_URL="postgresql://abdoul:azerty@localhost:5432/isseg?schema=public" \'
  echo 'ADMIN_EMAIL="admin@isseg.local" ADMIN_PASSWORD="Admin123!Secure" \'
  echo 'ADMIN_NOM="Administrateur" ADMIN_PRENOM="Système" npm run start:dev'
  echo ""
  exit 1
fi
echo "✅ Serveur NestJS détecté sur le port 3000"
echo ""

# Configuration
API_URL="http://localhost:3000/api/v1"
EMAIL="admin@isseg.local"
PASSWORD="Admin123!Secure"
CONCURRENT_REQUESTS=10

# Nettoyage
echo "📋 Étape 1 : Nettoyage de la base de données..."
PGPASSWORD=azerty psql -h localhost -U abdoul -d isseg -c "DELETE FROM \"RefreshToken\";" > /dev/null 2>&1
PGPASSWORD=azerty psql -h localhost -U abdoul -d isseg -c "DELETE FROM \"AuditLog\" WHERE action IN ('LOGIN_SUCCESS', 'TOKEN_REFRESHED');" > /dev/null 2>&1
echo "✅ Base nettoyée"
echo ""

# Login
echo "🔐 Étape 2 : Authentification et récupération du refresh token..."
LOGIN_RESPONSE=$(curl -s -c /tmp/isseg-cookies.txt -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"motDePasse\":\"${PASSWORD}\"}")

if [ $? -ne 0 ]; then
  echo "❌ Échec de l'authentification"
  exit 1
fi

ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Aucun access token reçu"
  echo "Réponse: $LOGIN_RESPONSE"
  exit 1
fi

# Extraire le refresh token du cookie
REFRESH_TOKEN=$(cat /tmp/isseg-cookies.txt | grep refreshToken | awk '{print $7}')

if [ -z "$REFRESH_TOKEN" ]; then
  echo "❌ Aucun refresh token dans le cookie"
  exit 1
fi

echo "✅ Authentification réussie"
echo "   Access token: ${ACCESS_TOKEN:0:50}..."
echo "   Refresh token: ${REFRESH_TOKEN:0:50}..."
echo ""

# Compter les refresh tokens actifs avant
TOKENS_BEFORE=$(PGPASSWORD=azerty psql -h localhost -U abdoul -d isseg -t -c "SELECT COUNT(*) FROM \"RefreshToken\" WHERE \"isRevoked\" = false;" | xargs)
echo "📊 Tokens actifs AVANT: $TOKENS_BEFORE"
echo ""

# Lancer les requêtes concurrentes
echo "🚀 Étape 3 : Lancement de ${CONCURRENT_REQUESTS} requêtes simultanées..."
echo ""

# Créer un fichier temporaire pour stocker les résultats
RESULTS_FILE="/tmp/isseg-race-test-results.txt"
rm -f "$RESULTS_FILE"

# Lancer les requêtes en parallèle
for i in $(seq 1 $CONCURRENT_REQUESTS); do
  (
    HTTP_CODE=$(curl -s -o /tmp/isseg-response-$i.txt -w "%{http_code}" \
      -b /tmp/isseg-cookies.txt \
      -X POST "${API_URL}/auth/refresh")
    echo "$i:$HTTP_CODE" >> "$RESULTS_FILE"
  ) &
done

# Attendre que toutes les requêtes se terminent
wait

echo "✅ Toutes les requêtes terminées"
echo ""

# Analyser les résultats
echo "📊 Étape 4 : Analyse des résultats..."
echo ""

SUCCESS_COUNT=$(grep -c ":200" "$RESULTS_FILE" || true)
FAILURE_COUNT=$(grep -c ":401" "$RESULTS_FILE" || true)

echo "   ✅ Succès (HTTP 200): $SUCCESS_COUNT"
echo "   ❌ Échecs (HTTP 401): $FAILURE_COUNT"
echo ""

# Afficher les détails
echo "Détails par requête:"
cat "$RESULTS_FILE" | sort -t: -k2 -r | while IFS=: read -r req_num http_code; do
  if [ "$http_code" = "200" ]; then
    echo "   Request #$req_num: HTTP $http_code ✅"
  else
    echo "   Request #$req_num: HTTP $http_code ❌"
  fi
done
echo ""

# Vérifier l'état de la base de données
echo "🗄️  Étape 5 : Vérification de la base de données..."
echo ""

TOKENS_AFTER=$(PGPASSWORD=azerty psql -h localhost -U abdoul -d isseg -t -c "SELECT COUNT(*) FROM \"RefreshToken\" WHERE \"isRevoked\" = false;" | xargs)
TOKENS_REVOKED=$(PGPASSWORD=azerty psql -h localhost -U abdoul -d isseg -t -c "SELECT COUNT(*) FROM \"RefreshToken\" WHERE \"isRevoked\" = true;" | xargs)
AUDIT_COUNT=$(PGPASSWORD=azerty psql -h localhost -U abdoul -d isseg -t -c "SELECT COUNT(*) FROM \"AuditLog\" WHERE action = 'TOKEN_REFRESHED';" | xargs)

echo "   Tokens actifs: $TOKENS_AFTER"
echo "   Tokens révoqués: $TOKENS_REVOKED"
echo "   Audit logs TOKEN_REFRESHED: $AUDIT_COUNT"
echo ""

# Vérifier les résultats attendus
echo "═══════════════════════════════════════════════════════════════"
echo "RÉSULTAT DU TEST"
echo "═══════════════════════════════════════════════════════════════"
echo ""

PASS=true

# Vérification 1: Exactement 1 succès
if [ "$SUCCESS_COUNT" -eq 1 ]; then
  echo "✅ PASS: Exactement 1 requête a réussi"
else
  echo "❌ FAIL: $SUCCESS_COUNT requêtes ont réussi (attendu: 1)"
  PASS=false
fi

# Vérification 2: Exactement N-1 échecs
EXPECTED_FAILURES=$((CONCURRENT_REQUESTS - 1))
if [ "$FAILURE_COUNT" -eq $EXPECTED_FAILURES ]; then
  echo "✅ PASS: $FAILURE_COUNT requêtes ont échoué (attendu: $EXPECTED_FAILURES)"
else
  echo "❌ FAIL: $FAILURE_COUNT requêtes ont échoué (attendu: $EXPECTED_FAILURES)"
  PASS=false
fi

# Vérification 3: Exactement 1 token actif après
if [ "$TOKENS_AFTER" -eq 1 ]; then
  echo "✅ PASS: 1 refresh token actif en base"
else
  echo "❌ FAIL: $TOKENS_AFTER refresh tokens actifs en base (attendu: 1)"
  PASS=false
fi

# Vérification 4: Exactement 1 audit log
if [ "$AUDIT_COUNT" -eq 1 ]; then
  echo "✅ PASS: 1 audit log TOKEN_REFRESHED créé"
else
  echo "❌ FAIL: $AUDIT_COUNT audit logs TOKEN_REFRESHED créés (attendu: 1)"
  PASS=false
fi

echo ""

if [ "$PASS" = true ]; then
  echo "🎉 TEST RÉUSSI — B4 RACE CONDITION PROTECTION VALIDÉE"
  exit 0
else
  echo "⚠️  TEST ÉCHOUÉ — Race condition détectée"
  exit 1
fi
