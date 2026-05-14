# Guide de déploiement Plesk — YookPay

## Workflow de déploiement

```
Git push → Plesk : git pull → bash deploy.sh → Restart
```

C'est tout. Le script `deploy.sh` fait tout automatiquement.

---

## Configuration Plesk (à faire une seule fois)

### Application Startup File
```
startup.js
```

### Node.js version
```
20 ou supérieure
```

### Variables d'environnement (Plesk → Node.js → Environment Variables)

| Variable               | Description                                      | Obligatoire |
|------------------------|--------------------------------------------------|-------------|
| `NODE_ENV`             | `production`                                     | ✅           |
| `SUPABASE_DATABASE_URL`| URL PostgreSQL Supabase                          | ✅           |
| `SESSION_SECRET`       | Clé secrète JWT (chaîne longue et aléatoire)     | ✅           |
| `APP_URL`              | URL publique (ex: `https://yookpay.com`)         | ✅           |
| `PIXPAY_API_KEY_XAF`   | Clé API PixPay — Cameroun (XAF)                 | ✅           |
| `PIXPAY_API_KEY_XOF`   | Clé API PixPay — Sénégal/Afrique de l'Ouest (XOF)| ✅          |
| `PIXPAY_API_KEY_CDF`   | Clé API PixPay — RDC (CDF)                      | ✅           |
| `PIXPAY_ENV`           | `production` ou `sandbox`                        | ✅           |
| `NOWPAYMENTS_API_KEY`  | Clé API NOWPayments (USDT)                       | ✅           |
| `NOWPAYMENTS_IPN_SECRET`| Secret IPN NOWPayments                          | ✅           |

> ⚠️ Ne pas définir `PORT` — Plesk le gère automatiquement.

---

## Déploiement initial (première fois)

1. Cloner le dépôt sur le serveur Plesk
2. Configurer les variables d'environnement ci-dessus
3. Exécuter le script de déploiement :
   ```bash
   bash deploy.sh
   ```
4. Appliquer le schéma de base de données (**une seule fois**) :
   ```bash
   pnpm --filter @workspace/db run push
   ```
5. Dans Plesk : configurer `startup.js` comme fichier de démarrage
6. Redémarrer l'application

---

## Mises à jour suivantes (workflow normal)

```bash
git pull
bash deploy.sh
# Puis : Restart dans Plesk
```

> Les migrations de base de données (`pnpm --filter @workspace/db run push`) ne sont nécessaires que si le schéma a changé. Ne pas lancer cette commande à chaque déploiement — elle peut supprimer des données si le schéma a évolué.

---

## Structure des fichiers compilés

```
startup.js                              ← Point d'entrée Plesk
artifacts/
  api-server/
    dist/
      index.cjs                         ← Backend compilé (démarré par startup.js)
      index.mjs                         ← Bundle ESM principal
      pino-*.mjs                        ← Workers de logs
  yookpay/
    dist/
      public/                           ← Frontend React compilé (servi par Express)
        index.html
        assets/
```

---

## Ce que fait le backend au démarrage

1. Connexion à la base de données PostgreSQL
2. Application des migrations SQL intégrées
3. Démarrage du serveur Express
4. Service du frontend React depuis `artifacts/yookpay/dist/public/`
5. Exposition de l'API sur `/api/*`
6. Démarrage du worker d'expiration des transactions
