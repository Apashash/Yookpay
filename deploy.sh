#!/bin/bash
# ============================================================
#  Script de build — YookPay (à exécuter sur Replit)
#
#  Ce script compile le frontend et le backend.
#  Les fichiers dist/ sont committés dans Git.
#  Sur Plesk : git pull + restart suffit, rien à installer.
#
#  Usage :
#    bash deploy.sh
#    git add -A && git commit -m "build" && git push
# ============================================================

set -e

echo ""
echo "========================================="
echo "  YookPay — Build (Replit)"
echo "========================================="
echo ""

# --- Build du frontend (React) ---
echo "▶ Build du frontend React..."
pnpm --filter @workspace/yookpay run build
echo "✓ Frontend compilé → artifacts/yookpay/dist/public/"

# --- Build du backend (Express) ---
echo ""
echo "▶ Build du backend Express..."
pnpm --filter @workspace/api-server run build
echo "✓ Backend compilé → artifacts/api-server/dist/index.cjs"

echo ""
echo "========================================="
echo "  ✅ Build terminé !"
echo ""
echo "  Prochaines étapes :"
echo "  git add -A && git commit -m 'build' && git push"
echo ""
echo "  Sur Plesk : git pull → Restart"
echo "  (aucune installation nécessaire côté Plesk)"
echo "========================================="
echo ""
