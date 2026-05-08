#!/bin/bash
# ============================================================
#  Script de déploiement Plesk — YookPay
#  Exécutez ce script après chaque `git pull` sur le serveur.
#
#  Variables d'environnement requises dans Plesk :
#    PORT                  ex: 3000
#    SUPABASE_DATABASE_URL  URL PostgreSQL (Supabase ou autre)
#    JWT_SECRET            clé secrète JWT (chaîne aléatoire longue)
#    PIXPAY_API_KEY        clé API PixPay
#    PIXPAY_ENV            "production" ou "sandbox"
#    NOWPAYMENTS_API_KEY   clé API NOWPayments (optionnel)
#    NOWPAYMENTS_EMAIL     email NOWPayments (optionnel)
#    NOWPAYMENTS_PASSWORD  mot de passe NOWPayments (optionnel)
# ============================================================

set -e

echo "▶ Installation des dépendances..."
npm install --production --ignore-scripts

echo "▶ Lancement du serveur..."
node dist/index.cjs
