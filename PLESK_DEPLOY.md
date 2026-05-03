# Guide de déploiement Plesk — YookPay

## Architecture
Le backend Express (`app.js`) sert à la fois l'API (`/api/...`) et le frontend React (fichiers statiques).
**Un seul processus Node.js suffit pour tout faire tourner.**

---

## Étape 1 — Cloner le repo sur Plesk

Dans Plesk > Git, connecte ton repo GitHub et fais un pull :
```
git clone https://github.com/TON_USER/TON_REPO.git .
```
ou via le panel Git de Plesk → **Pull**.

---

## Étape 2 — Configuration Node.js dans Plesk

Dans **Plesk > Node.js** :

| Champ | Valeur |
|---|---|
| Application Mode | `production` |
| Application Root | `/` (racine du repo) |
| Application Startup File | `app.js` |
| Node.js version | `20` ou `22` |

> ⚠️ **Pas besoin de lancer `npm install`** — le backend est déjà compilé et auto-suffisant dans `artifacts/api-server/dist/`.

---

## Étape 3 — Variables d'environnement dans Plesk

Dans **Plesk > Node.js > Environment Variables**, ajoute :

| Variable | Description |
|---|---|
| `PORT` | Assigné automatiquement par Plesk — laisser vide |
| `NODE_ENV` | `production` |
| `SUPABASE_DATABASE_URL` | `postgresql://postgres.XXXXX:MOT_DE_PASSE@aws-1-eu-west-2.pooler.supabase.com:6543/postgres` |
| `SESSION_SECRET` | Une longue chaîne aléatoire secrète |
| `APP_URL` | `https://ton-domaine.cybrancee.com` |
| `PIXPAY_API_KEY_XAF` | Clé PixPay pour XAF |
| `PIXPAY_API_KEY_XOF` | Clé PixPay pour XOF |
| `PIXPAY_API_KEY_CDF` | Clé PixPay pour CDF |
| `PIXPAY_ENV` | `production` (ou `sandbox` pour les tests) |
| `NOWPAYMENTS_API_KEY` | Clé NowPayments |
| `NOWPAYMENTS_IPN_SECRET` | Secret IPN NowPayments |
| `NOWPAYMENTS_EMAIL` | Email NowPayments |
| `NOWPAYMENTS_PASSWORD` | Mot de passe NowPayments |

---

## Étape 4 — Démarrer

Dans Plesk > Node.js → **Restart**.

L'app sera disponible sur `https://ton-domaine.cybrancee.com`

---

## Workflow quotidien (après mise à jour du code)

1. Dans Replit : faire les modifications → le build se génère automatiquement
2. Push vers GitHub
3. Dans Plesk : **Git → Pull** puis **Node.js → Restart**

C'est tout. ✓

---

## En cas d'erreur

### "PORT environment variable is required"
→ Plesk assigne le PORT automatiquement. Vérifie que `app.js` est bien le startup file.

### "password authentication failed for user postgres"
→ La variable `SUPABASE_DATABASE_URL` est manquante ou incorrecte dans Plesk.

### Pages blanches / 404 sur rafraîchissement
→ Normal — Express gère le routage SPA. Vérifie que le startup file est `app.js` et non un fichier HTML.
