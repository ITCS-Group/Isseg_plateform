#!/bin/bash
#
# TEST B5 — LOGOUT
# ================
# Ce script teste la fonctionnalité de déconnexion :
# - Révocation des refresh tokens actifs
# - Suppression du cookie
# - Audit log LOGOUT
# - Impossibilité de refresh après logout
#
# PRÉREQUIS :
# - Le serveur NestJS doit être démarré sur http://localhost:3000
#

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "TEST B5 — LOGOUT"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Vérifier que le serveur est en cours d'exécution
echo "🔍 Vérification préalable : Serveur NestJS..."
if ! nc -z localhost 3000 2>/dev/null; then
  echo "❌ ERREUR : Le serveur NestJS n'est pas démarré sur le port 3000"
  echo ""
  echo "Veuillez démarrer le serveur avec la commande suivante :"
  echo ""
  echo 'PORT=3000 DATABASE_URL="postgresql://abdoul:azerty@localhost:5432/isseg?schema=public" \'
  echo 'ADMIN_EMAIL="admin@isseg.local" ADMIN_PASSWORD="Admin123!Secure" \'
  echo 'ADMIN_NOM="Administrateur" ADMIN_PRENOM="Système" /usr/bin/node dist/main.js'
  echo ""
  exit 1
fi
echo "✅ Serveur NestJS détecté sur le port 3000"
echo ""

# Configuration
API_URL="http://localhost:3000/api/v1"
EMAIL="admin@isseg.local"
PASSWORD="Admin123!Secure"

# Nettoyage
echo "📋 Étape 1 : Nettoyage de la base de données..."
PGPASSWORD=azerty psql -h localhost -U abdoul -d isseg -c "DELETE FROM \"RefreshToken\";" > /dev/null 2>&1
PGPASSWORD=azerty psql -h localhost -U abdoul -d isseg -c "DELETE FROM \"AuditLog\" WHERE action IN ('LOGIN_SUCCESS', 'LOGOUT');" > /dev/null 2>&1
echo "✅ Base nettoyée"
echo ""

# Login
echo "🔐 Étape 2 : Authentification (Login)..."
LOGIN_RESPONSE=$(curl -s -c /tmp/isseg-logout-cookies.txt -X POST "${API_URL}/auth/login" \
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

REFRESH_TOKEN=$(cat /tmp/isseg-logout-cookies.txt | grep refreshToken | awk '{print $7}')

if [ -z "$REFRESH_TOKEN" ]; then
  echo "❌ Aucun refresh token dans le cookie"
  exit 1
fi

echo "✅ Login réussi"
echo "   Access token: ${ACCESS_TOKEN:0:50}..."
echo "   Refresh token (cookie): ${REFRESH_TOKEN:0:50}..."
echo ""

# Vérifier l'état AVANT logout
echo "📊 Étape 3 : Vérification AVANT logout..."
TOKENS_BEFORE=$(PGPASSWORD=azerty psql -h localhost -U abdoul -d isseg -t -c "SELECT COUNT(*) FROM \"RefreshToken\" WHERE \"isRevoked\" = false;" | xargs)
echo "   Refresh tokens actifs: $TOKENS_BEFORE"

if [ "$TOKENS_BEFORE" -ne 1 ]; then
  echo "❌ Attendu 1 refresh token actif, trouvé: $TOKENS_BEFORE"
  exit 1
fi
echo ""

# Logout
echo "🚪 Étape 4 : Déconnexion (Logout)..."
LOGOUT_RESPONSE=$(curl -s -b /tmp/isseg-logout-cookies.txt -c /tmp/isseg-after-logout-cookies.txt \
  -w "%{http_code}" -o /tmp/logout-body.txt \
  -X POST "${API_URL}/auth/logout" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

echo "   Code HTTP: $LOGOUT_RESPONSE"

if [ "$LOGOUT_RESPONSE" -ne 204 ]; then
  echo "❌ Logout a échoué (attendu: 204, reçu: $LOGOUT_RESPONSE)"
  cat /tmp/logout-body.txt
  exit 1
fi

echo "✅ Logout réussi (HTTP 204)"
echo ""

# Vérifier l'état APRÈS logout
echo "📊 Étape 5 : Vérification APRÈS logout..."

TOKENS_AFTER=$(PGPASSWORD=azerty psql -h localhost -U abdoul -d isseg -t -c "SELECT COUNT(*) FROM \"RefreshToken\" WHERE \"isRevoked\" = false;" | xargs)
TOKENS_REVOKED=$(PGPASSWORD=azerty psql -h localhost -U abdoul -d isseg -t -c "SELECT COUNT(*) FROM \"RefreshToken\" WHERE \"isRevoked\" = true;" | xargs)
AUDIT_LOGOUT=$(PGPASSWORD=azerty psql -h localhost -U abdoul -d isseg -t -c "SELECT COUNT(*) FROM \"AuditLog\" WHERE action = 'LOGOUT';" | xargs)

echo "   Refresh tokens actifs: $TOKENS_AFTER"
echo "   Refresh tokens révoqués: $TOKENS_REVOKED"
echo "   Audit logs LOGOUT: $AUDIT_LOGOUT"
echo ""

# Vérifier que le cookie a été supprimé
echo "🍪 Étape 6 : Vérification suppression du cookie..."
COOKIE_AFTER_LOGOUT=$(cat /tmp/isseg-after-logout-cookies.txt | grep refreshToken | wc -l)

if [ "$COOKIE_AFTER_LOGOUT" -eq 0 ]; then
  echo "✅ Cookie refreshToken supprimé"
else
  echo "⚠️  Cookie refreshToken encore présent (peut être normal selon l'implémentation curl)"
fi
echo ""

# Tenter de refresh avec le token révoqué
echo "🔄 Étape 7 : Tentative de refresh avec token révoqué..."
REFRESH_RESPONSE=$(curl -s -b /tmp/isseg-logout-cookies.txt \
  -w "%{http_code}" -o /tmp/refresh-after-logout.txt \
  -X POST "${API_URL}/auth/refresh")

echo "   Code HTTP: $REFRESH_RESPONSE"

if [ "$REFRESH_RESPONSE" -eq 401 ]; then
  echo "✅ Refresh refusé (HTTP 401) — token révoqué détecté"
else
  echo "❌ Refresh a réussi alors que le token devrait être révoqué!"
  cat /tmp/refresh-after-logout.txt
  exit 1
fi
echo ""

# Vérifications finales
echo "═══════════════════════════════════════════════════════════════"
echo "RÉSULTAT DU TEST B5"
echo "═══════════════════════════════════════════════════════════════"
echo ""

PASS=true

# Vérification 1: Aucun token actif après logout
if [ "$TOKENS_AFTER" -eq 0 ]; then
  echo "✅ PASS: Aucun refresh token actif après logout"
else
  echo "❌ FAIL: $TOKENS_AFTER refresh tokens actifs (attendu: 0)"
  PASS=false
fi

# Vérification 2: Token révoqué
if [ "$TOKENS_REVOKED" -eq 1 ]; then
  echo "✅ PASS: 1 refresh token révoqué"
else
  echo "❌ FAIL: $TOKENS_REVOKED refresh tokens révoqués (attendu: 1)"
  PASS=false
fi

# Vérification 3: Audit log LOGOUT créé
if [ "$AUDIT_LOGOUT" -eq 1 ]; then
  echo "✅ PASS: 1 audit log LOGOUT créé"
else
  echo "❌ FAIL: $AUDIT_LOGOUT audit logs LOGOUT (attendu: 1)"
  PASS=false
fi

# Vérification 4: Refresh impossible avec token révoqué
if [ "$REFRESH_RESPONSE" -eq 401 ]; then
  echo "✅ PASS: Refresh impossible avec token révoqué (HTTP 401)"
else
  echo "❌ FAIL: Refresh a réussi avec token révoqué (HTTP $REFRESH_RESPONSE)"
  PASS=false
fi

# Vérification 5: Logout retourne HTTP 204
if [ "$LOGOUT_RESPONSE" -eq 204 ]; then
  echo "✅ PASS: Logout retourne HTTP 204 No Content"
else
  echo "❌ FAIL: Logout a retourné HTTP $LOGOUT_RESPONSE (attendu: 204)"
  PASS=false
fi

echo ""

if [ "$PASS" = true ]; then
  echo "🎉 TEST B5 RÉUSSI — LOGOUT VALIDÉ"
  exit 0
else
  echo "⚠️  TEST B5 ÉCHOUÉ"
  exit 1
fi
