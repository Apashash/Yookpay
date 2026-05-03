# Guide de déploiement Plesk — YookPay

## Architecture

Un seul fichier `dist/index.cjs` sert à la fois l'API Express et le frontend React (fichiers statiques dans `dist/public/`). Tout est pré-compilé et commité dans git — **aucun npm run build côté Plesk**.

```
dist/
  index.cjs                ← Startup file Plesk (backend bundlé, auto-suffisant)
  pino-*.cjs               ← Workers pino (logging)
  thread-stream-worker.cjs
  public/
    index.html             ← Frontend React
    assets/                ← JS/CSS minifiés
```

---

## Étape 1 — Cloner / Pull le repo

Dans **Plesk > Git** : connecte le repo GitHub et clique **Pull**.

---

## Étape 2 — Configuration Node.js dans Plesk

Dans **Plesk > Node.js** :

| Champ | Valeur |
|---|---|
| Application Mode | `production` |
| Application Root | `/` (racine du repo) |
| **Application Startup File** | **`startup.js`** |
| Node.js version | `21` (ou `20` / `22` si disponible) |

> ⚠️ **Le startup file doit être `startup.js`**, pas `app.js` ni `dist/index.cjs` directement.
> `startup.js` configure le PORT et l'env avant de charger `dist/index.cjs`.

---

## Étape 3 — Variables d'environnement dans Plesk

Dans **Plesk > Node.js > Environment Variables**, ajouter :

| Variable | Valeur | Obligatoire |
|---|---|---|
| `NODE_ENV` | `production` | ✅ |
| `SUPABASE_DATABASE_URL` | `postgresql://postgres.XXXXX:PASSWORD@aws-1-eu-west-2.pooler.supabase.com:6543/postgres` | ✅ |
| `SESSION_SECRET` | Une longue chaîne aléatoire (ex: 64 caractères) | ✅ |
| `APP_URL` | `https://Yook.ashtechpay.top` | ✅ |
| `PIXPAY_API_KEY_XAF` | Clé PixPay pour XAF | selon usage |
| `PIXPAY_API_KEY_XOF` | Clé PixPay pour XOF | selon usage |
| `PIXPAY_API_KEY_CDF` | Clé PixPay pour CDF | selon usage |
| `PIXPAY_ENV` | `production` (ou `sandbox`) | selon usage |
| `NOWPAYMENTS_API_KEY` | Clé NowPayments | selon usage |
| `NOWPAYMENTS_IPN_SECRET` | Secret IPN NowPayments | selon usage |
| `NOWPAYMENTS_EMAIL` | Email NowPayments | selon usage |
| `NOWPAYMENTS_PASSWORD` | Mot de passe NowPayments | selon usage |

> ❌ **Ne pas ajouter `PORT`** — Plesk l'assigne automatiquement.

---

## Étape 4 — NPM Install dans Plesk

Dans Plesk > Node.js → cliquer **NPM Install**.

Les warnings `EBADENGINE` pour vite/react sont normaux et n'empêchent pas le fonctionnement (le build est déjà dans `dist/`, vite n'est pas exécuté côté serveur).

---

## Étape 5 — Démarrer

Dans Plesk > Node.js → **Restart**.

L'app sera disponible sur `https://Yook.ashtechpay.top` ✓

Tester : `https://Yook.ashtechpay.top/healthz` doit renvoyer `{"status":"ok"}`

---

## Workflow quotidien (après mise à jour du code)

1. Dans Replit : faire les modifications
2. Lancer le build : `npm run build` (génère `dist/index.cjs` + `dist/public/`)
3. Push vers GitHub
4. Dans Plesk : **Git → Pull** puis **Node.js → Restart**

C'est tout. ✓

---

## Dépannage

### Erreur : "dist/index.cjs introuvable"
→ Le dossier `dist/` n'a pas été commité dans git. Vérifier que `.gitignore` n'exclut pas `dist/`.

### Erreur : "SUPABASE_DATABASE_URL must be set"
→ La variable d'environnement est absente dans Plesk > Node.js > Environment Variables.

### Erreur 500 au démarrage
→ Vérifier les logs Plesk. Cause la plus fréquente : `SUPABASE_DATABASE_URL` manquant.

### "password authentication failed for user postgres"
→ Le mot de passe dans `SUPABASE_DATABASE_URL` est incorrect ou le token Supabase a expiré.

### Pages blanches / 404 sur rafraîchissement
→ Normal — Express gère le routage SPA. Vérifier que le startup file est `startup.js`.

### Les warnings EBADENGINE dans npm install
→ Ce sont des avertissements sans conséquence. `dist/` est pré-compilé, vite n'est pas utilisé côté serveur. Cliquer **Done** et continuer.
