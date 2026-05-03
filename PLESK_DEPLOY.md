# Guide de déploiement Plesk — YookPay

## Structure

- `client/src/` : frontend React
- `server/` : backend Express
- `shared/` : schémas/types partagés
- `dist/index.cjs` : build final backend prêt pour Plesk

## Déploiement Plesk

1. `npm run build`
2. Plesk pointe sur `dist/index.cjs`
3. Variables d’environnement configurées dans Plesk
4. L’app sert le frontend compilé + API Express sur le même serveur

## Entrée / démarrage

- Dev : `npm run dev`
- Prod build : `npm run build`
- Entrée Plesk : `dist/index.cjs`

## Fichiers importants

- `client/src/App.tsx` — routing frontend
- `client/src/pages/` — pages React
- `client/src/components/` — composants UI
- `server/index.ts` — serveur Express principal
- `server/routes.ts` — routes API
- `server/storage.ts` — couche data
- `shared/schema.ts` — schémas + types partagés

## Flux

- React rend le frontend
- Express sert l’API
- `shared/schema.ts` garde les types synchronisés
- `npm run build` compile le tout en `dist/index.cjs`
- Plesk exécute ce fichier

## Ce qui est préparé

- build unique prêt serveur
- pas de proxy Vite à configurer
- frontend/backend sur le même runtime
- support des variables d’environnement

## Configuration Plesk

- Application Startup File : `dist/index.cjs`
- Node.js version : 21 ou 22
- `NODE_ENV=production`
- `SUPABASE_DATABASE_URL` défini
- `SESSION_SECRET` défini
- `APP_URL` défini

## Notes

- Ne pas modifier les workflows
- Ne pas forcer `PORT` dans Plesk
