# Guide de déploiement Plesk — YookPay

## Architecture

Un seul fichier `dist/index.cjs` sert à la fois l'API Express et le frontend React (fichiers statiques dans `dist/public/`).

```
dist/
  index.cjs                ← Startup file Plesk (backend bundlé, ~2.6MB, auto-suffisant)
  pino-*.cjs               ← Workers pino (logging)
  thread-stream-worker.cjs
  public/
    index.html             ← Frontend React buildé
    assets/                ← JS/CSS bundlés par Vite
```

---

## Étape 1 — Cloner le repo sur Plesk

Dans Plesk > Git, connecte ton repo GitHub et fais un pull.

---

## Étape 2 — Configuration Node.js dans Plesk

Dans **Plesk > Node.js** :

| Champ | Valeur |
|---|---|
| Application Mode | `production` |
| Application Root | `/` (racine du repo) |
| **Application Startup File** | **`dist/index.cjs`** |
| Node.js version | `20` ou `22` |

> ✅ **Pas besoin de npm install ni npm build** — tout est déjà compilé dans `dist/`.

---

## Étape 3 — Variables d'environnement dans Plesk

Dans **Plesk > Node.js > Environment Variables** :

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

L'app sera disponible sur `https://ton-domaine.cybrancee.com` ✓

---

## Workflow quotidien (après mise à jour du code)

1. Dans Replit : faire les modifications
2. Lancer le build : `npm run build` (génère `dist/index.cjs` + `dist/public/`)
3. Push vers GitHub
4. Dans Plesk : **Git → Pull** puis **Node.js → Restart**

C'est tout. ✓

---

## Structure du projet

```
client/src/       ← Frontend React (source)
server/           ← Backend Express (source)
shared/           ← DB schema + types partagés
dist/index.cjs    ← Build final backend (Plesk startup file)
dist/public/      ← Build final frontend (servi par Express)
```

---

## Commandes build

```bash
npm run build:frontend   # Vite → dist/public/
npm run build:backend    # esbuild → dist/index.cjs
npm run build            # Les deux ensemble
```

---

## En cas d'erreur

### Erreur 500 au démarrage
→ Vérifier que le startup file est bien `dist/index.cjs` (et non `app.js` ou `startup.js`)

### "password authentication failed for user postgres"
→ La variable `SUPABASE_DATABASE_URL` est manquante ou incorrecte dans Plesk.

### Pages blanches / 404 sur rafraîchissement
→ Normal — Express gère le routage SPA. Vérifie que le startup file est `dist/index.cjs`.

### "PORT environment variable is required"
→ Ne jamais ajouter PORT manuellement — Plesk l'assigne automatiquement.
