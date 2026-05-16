#!/bin/bash
# ============================================================
#  deploy.sh — Build complet + push GitHub (Replit)
#
#  Usage :
#    bash deploy.sh
#    bash deploy.sh "message de commit"
#
#  Dans Plesk ensuite : git pull → Restart
#  Aucune installation ni build côté Plesk.
# ============================================================

set -e

COMMIT_MSG="${1:-deploy: build $(date '+%Y-%m-%d %H:%M')}"

echo ""
echo "========================================="
echo "  YookPay — Build & Push"
echo "========================================="
echo ""

# ── 1. Build backend ──────────────────────────────────────
echo "▶ [1/3] Build backend (esbuild)..."
pnpm --filter @workspace/api-server run build
echo "    ✓ artifacts/api-server/dist/index.cjs"
echo ""

# ── 2. Build frontend ─────────────────────────────────────
echo "▶ [2/3] Build frontend (Vite)..."
pnpm --filter @workspace/yookpay run build
echo "    ✓ artifacts/yookpay/dist/public/"
echo ""

# ── 3. Git commit + push ──────────────────────────────────
echo "▶ [3/3] Git commit & push → GitHub..."
git add -A
git diff --cached --stat
git commit -m "$COMMIT_MSG" || echo "    (rien de nouveau à committer)"
git push origin main
echo "    ✓ Push OK"

echo ""
echo "========================================="
echo "  ✅ Terminé !"
echo ""
echo "  Dans Plesk :"
echo "    1. git pull"
echo "    2. Restart"
echo "========================================="
echo ""
