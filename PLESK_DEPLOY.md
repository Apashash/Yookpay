# Déploiement Plesk — YookPay

## Workflow complet

```
[Replit]  bash deploy.sh
[Replit]  git add -A && git commit -m "build" && git push

[Plesk]   git pull
[Plesk]   Restart
```

C'est tout. Aucune installation ni build côté Plesk — tout est déjà compilé dans `dist/`.

---

## Pourquoi ça marche sans installation sur Plesk

- Le backend est compilé en un seul fichier autonome : `artifacts/api-server/dist/index.mjs`  
  (toutes les dépendances sont bundlées à l'intérieur via esbuild)
- Le frontend est compilé en fichiers statiques : `artifacts/yookpay/dist/public/`  
  (servis directement par Express)
- Ces fichiers `dist/` sont **committés dans Git** — Plesk n'a qu'à les récupérer

---

## Configuration Plesk (une seule fois)

### Application Startup File
```
startup.js
```

### Node.js version
```
20 ou supérieure
```

### Variables d'environnement (Plesk → Node.js → Environment Variables)

| Variable                 | Exemple / Description                          |
|--------------------------|------------------------------------------------|
| `NODE_ENV`               | `production`                                   |
| `SUPABASE_DATABASE_URL`  | URL PostgreSQL Supabase (port 6543)            |
| `SESSION_SECRET`         | Clé JWT longue et aléatoire                    |
| `APP_URL`                | `https://yookpay.com`                          |
| `PIXPAY_API_KEY_XAF`     | Clé PixPay Cameroun                            |
| `PIXPAY_API_KEY_XOF`     | Clé PixPay Sénégal / Afrique de l'Ouest        |
| `PIXPAY_API_KEY_CDF`     | Clé PixPay RDC                                 |
| `PIXPAY_ENV`             | `production`                                   |
| `NOWPAYMENTS_API_KEY`    | Clé NOWPayments (USDT)                         |
| `NOWPAYMENTS_IPN_SECRET` | Secret IPN NOWPayments                         |

> ⚠️ Ne pas définir `PORT` — Plesk le gère automatiquement.

---

## Migrations de base de données

À exécuter **sur Replit**, uniquement si le schéma a changé :
```bash
pnpm --filter @workspace/db run push
```
Ne pas lancer à chaque déploiement.

---

## Structure des fichiers déployés

```
startup.js                                ← Point d'entrée Plesk
artifacts/
  api-server/dist/
    index.cjs                             ← Wrapper CJS (chargé par startup.js)
    index.mjs                             ← Bundle backend complet (auto-contenu)
    pino-*.mjs                            ← Workers de logs
  yookpay/dist/public/
    index.html                            ← Frontend React
    assets/                               ← JS + CSS compilés
```
