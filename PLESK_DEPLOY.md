# Déploiement Plesk — YookPay

## Workflow complet

```
[Replit]  bash deploy.sh

[Plesk]   git pull
[Plesk]   Restart
```

C'est tout. Aucune installation ni build côté Plesk — tout est déjà compilé.

---

## Pourquoi ça marche sans installation sur Plesk

- Le backend est compilé en **un seul fichier autonome** : `artifacts/api-server/dist/index.cjs`
  (toutes les dépendances sont bundlées à l'intérieur via esbuild — pas de `node_modules` nécessaire)
- Le frontend est compilé en **fichiers statiques** : `artifacts/yookpay/dist/public/`
  (servis directement par Express depuis le backend)
- Ces fichiers `dist/` sont **committés dans Git** — Plesk n'a qu'à les récupérer

---

## Configuration Plesk (une seule fois)

### Application Startup File
```
startup.js
```
> Ce fichier est à la racine du repo. Il charge `artifacts/api-server/dist/index.cjs`.

### Node.js version
```
20 ou supérieure
```

### Variables d'environnement (Plesk → Node.js → Environment Variables)

| Variable                 | Description                                     |
|--------------------------|-------------------------------------------------|
| `NODE_ENV`               | `production`                                    |
| `SUPABASE_DATABASE_URL`  | URL PostgreSQL Supabase (Transaction Pooler, port 6543) |
| `SESSION_SECRET`         | Clé JWT longue et aléatoire                     |
| `APP_URL`                | URL publique (ex: `https://yookpay.com`)        |
| `PIXPAY_API_KEY_XAF`     | Clé PixPay — Cameroun / Gabon / Congo           |
| `PIXPAY_API_KEY_XOF`     | Clé PixPay — Sénégal / CI / Bénin / BF / Mali… |
| `PIXPAY_API_KEY_CDF`     | Clé PixPay — RDC                                |
| `NOWPAYMENTS_API_KEY`    | Clé NOWPayments (USDT)                          |
| `NOWPAYMENTS_IPN_SECRET` | Secret IPN NOWPayments                          |

> **Ne pas définir `PORT`** — Plesk le gère automatiquement via Passenger.

---

## Commande de démarrage Plesk

Plesk démarre l'app via Passenger (Phusion Passenger for Node.js).  
Le startup file `startup.js` est le seul point d'entrée — il ne faut **rien d'autre**.

Si Plesk demande une commande de démarrage custom, utiliser :
```
node startup.js
```

---

## Migrations de base de données

À exécuter **sur Replit uniquement**, si le schéma a changé :
```bash
pnpm --filter @workspace/db run push
```
Ne pas lancer à chaque déploiement.

---

## Structure des fichiers déployés

```
startup.js                               ← Point d'entrée Plesk (charge le backend)
artifacts/
  api-server/dist/
    index.cjs                            ← Bundle backend complet (auto-contenu, ~2.6 MB)
    index.cjs.map                        ← Source map (debug)
    pino-worker.cjs                      ← Worker de logs (pino)
    pino-file.cjs                        ← Worker de logs (pino)
    pino-pretty.cjs                      ← Worker de logs (pino)
    thread-stream-worker.cjs             ← Worker de logs (thread-stream)
  yookpay/dist/public/
    index.html                           ← Frontend React (SPA)
    assets/
      index-*.js                         ← JS compilé (Vite)
      index-*.css                        ← CSS compilé (Tailwind)
    favicon.ico / favicon.svg / logo.png
```

---

## Dépannage

### L'app ne démarre pas
- Vérifier que toutes les variables d'environnement sont définies dans Plesk
- Vérifier que `NODE_ENV=production` est bien défini
- Consulter les logs Plesk → Node.js → Logs

### Page blanche / 404 sur les routes frontend
- Le frontend est une SPA React — toutes les routes doivent retourner `index.html`
- Express gère ça automatiquement : toute route non-API retourne `artifacts/yookpay/dist/public/index.html`
- Vérifier que `artifacts/yookpay/dist/public/` est bien présent dans le repo

### Erreur de connexion base de données
- Vérifier `SUPABASE_DATABASE_URL` → doit utiliser le **Transaction Pooler** (port 6543)
- Format : `postgresql://postgres.xxx:PASSWORD@aws-1-eu-west-2.pooler.supabase.com:6543/postgres`
