#!/bin/bash
# ============================================================
#  Script de déploiement Plesk — YookPay
#  Exécutez ce script APRÈS chaque `git pull` dans Plesk.
#
#  Variables d'environnement requises dans Plesk :
#    SUPABASE_DATABASE_URL   URL PostgreSQL (Supabase ou autre)
#    SESSION_SECRET          Clé secrète JWT (chaîne aléatoire longue)
#    PIXPAY_API_KEY_XAF      Clé API PixPay Cameroun (XAF)
#    PIXPAY_API_KEY_XOF      Clé API PixPay Sénégal/Afrique de l'Ouest (XOF)
#    PIXPAY_API_KEY_CDF      Clé API PixPay RDC (CDF)
#    PIXPAY_ENV              "production" ou "sandbox"
#    NOWPAYMENTS_API_KEY     Clé API NOWPayments (USDT)
#    NOWPAYMENTS_IPN_SECRET  Secret IPN NOWPayments
#    APP_URL                 URL publique de l'application (ex: https://yookpay.com)
#    NODE_ENV                "production"
# ============================================================

set -e

echo ""
echo "========================================="
echo "  YookPay — Déploiement Plesk"
echo "========================================="
echo ""

# --- 1. Vérification de pnpm ---
if ! command -v pnpm &> /dev/null; then
  echo "▶ pnpm non trouvé — installation via npm..."
  npm install -g pnpm
fi
echo "✓ pnpm $(pnpm --version)"

# --- 2. Installation des dépendances ---
echo ""
echo "▶ Installation des dépendances..."
pnpm install --frozen-lockfile
echo "✓ Dépendances installées"

# --- 3. Build du frontend (React) ---
echo ""
echo "▶ Build du frontend React..."
pnpm --filter @workspace/yookpay run build
echo "✓ Frontend compilé → artifacts/yookpay/dist/public/"

# --- 4. Build du backend (Express) ---
echo ""
echo "▶ Build du backend Express..."
pnpm --filter @workspace/api-server run build
echo "✓ Backend compilé → artifacts/api-server/dist/index.cjs"

echo ""
echo "========================================="
echo "  ✅ Build terminé avec succès !"
echo ""
echo "  Dans Plesk :"
echo "  • Application Startup File : startup.js"
echo "  • Node.js version : 20 ou supérieure"
echo "  • NODE_ENV=production"
echo ""
echo "  ⚠ Pour les migrations de base de données :"
echo "  Exécutez séparément (si nouveau schéma) :"
echo "  pnpm --filter @workspace/db run push"
echo "========================================="
echo ""
