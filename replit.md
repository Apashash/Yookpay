# YookPay - African Payment Platform

## Overview

YookPay is a premium fintech platform for African markets — a multi-currency mobile money aggregator supporting Cameroon (XAF), Senegal (XOF), DRC (CDF), and USDT (crypto). Built with a Stripe/PayPal-style design philosophy.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: Supabase (PostgreSQL) + Drizzle ORM
- **Validation**: Zod (`zod`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle, self-contained — no npm install needed on production)
- **Frontend**: React + Vite + Tailwind CSS + Shadcn/UI
- **Auth**: JWT (bcryptjs + jsonwebtoken)
- **Rate limiting**: express-rate-limit
- **HTTP logging**: pino + pino-http

## Key Features

### Backend
- **Rate limiting**: Global (200/15min), Auth (10/15min), Transactions (5/min per user)
- **Transaction logs**: Structured pino logging for every transaction event (create, success, failure)
- **Dynamic fee system**: Per-country, per-operator, per-type fee table (rate, minFee, maxFee)
- **PixPay Innov API**: Real payment processing via proxy-coreapi.pixelinnov.net (prod) / standbox-api.pixelinnov.net (sandbox)
- **NowPayments API**: USDT crypto deposits (TRC-20) and withdrawals via NowPayments
- **USDT Exchange**: Fiat→USDT (instant, 2% fee) and USDT→Fiat (admin approval, 2% fee)
- **FX Rates**: open.er-api.com (1h cache) with fallback (XAF=600, XOF=600, CDF=2800 per USD)
- **Webhook/IPN support**: POST /api/transactions/webhook + POST /api/nowpayments/ipn
- **Admin panel**: User management, KYC queue, PixPay config, Conversion rates, Exchanges (USDT)
- **Static file serving**: Express serves the pre-built React frontend in production

### Frontend
- **UI style**: Dark fintech theme (navy + electric indigo accent), Inter font
- **Dashboard**: Wallet balances (XAF/XOF/CDF/USDT 4-column grid), 7-day volume chart
- **Deposit form**: Mobile Money tab (country/operator selector, live fee preview) + Crypto USDT tab (TRC-20 address)
- **Withdrawal form**: Mobile Money tab + Crypto USDT tab (address + network selection)
- **Transfer**: "Virement Interne" (XAF/XOF/CDF) + "Échange USDT" with 2-step stepper
- **Transaction history**: Paginated table with status badges and filters
- **Admin exchanges**: Approve/reject USDT exchange requests with notes
- **JWT auth**: Token stored in localStorage ("yookpay_token"), setAuthTokenGetter wires all API calls
- **French language interface**: All UI text in French

## Database (Supabase)

- **Project URL**: https://tcgvodxxtbipghukgifv.supabase.co
- **Connection**: Transaction Pooler (port 6543)
- **Tables**: users, wallets, transactions, api_keys, kyc_documents, kyc_profiles, user_fees, user_operator_fees, crypto_exchanges, conversion_fees, pixpay_services, platform_config, notifications, payment_links, support_links, usdt_rates

## Currency Map
- Cameroon (CM) → XAF (PixPay key: PIXPAY_API_KEY_XAF)
- Senegal (SN) → XOF (PixPay key: PIXPAY_API_KEY_XOF)
- DRC (CD) → CDF (PixPay key: PIXPAY_API_KEY_CDF)
- USDT (ZZ) → USDT via NowPayments

## Operators
- MTN, ORANGE, MOOV, WAVE

## Environment Variables (Secrets)
- `SUPABASE_DATABASE_URL` — Supabase PostgreSQL connection string (primary)
- `SESSION_SECRET` — JWT signing secret
- `PIXPAY_API_KEY_CDF` — PixPay API key for CDF transactions
- `PIXPAY_API_KEY_XAF` — PixPay API key for XAF transactions
- `PIXPAY_API_KEY_XOF` — PixPay API key for XOF transactions
- `NOWPAYMENTS_API_KEY` — NowPayments API key (for USDT)
- `NOWPAYMENTS_IPN_SECRET` — NowPayments IPN HMAC secret
- `APP_URL` — Public URL for NowPayments IPN callbacks (production)

## Demo Credentials
- Email: demo@yookpay.com
- Password: Demo1234!

## Admin Credentials
- Email: Mfouapon0237@gmail.com

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — build frontend + backend
- `npm start` — start production server (uses pre-built dist)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes to Supabase

## Plesk Deployment (Node.js)

Le projet est pré-compilé pour un déploiement Plesk sans build sur le serveur.

### Structure de déploiement
```
app.js                              ← Point d'entrée Plesk (npm start)
artifacts/api-server/dist/          ← Backend bundlé (auto-suffisant, pas besoin de node_modules)
  index.mjs                         ← Bundle principal (~2.6MB, tout inclus)
  pino-*.mjs                        ← Workers pino (logging)
  thread-stream-worker.mjs
artifacts/yookpay/dist/public/      ← Frontend React buildé (servi par Express)
  index.html
  assets/
.env.example                        ← Template des variables d'environnement
```

### Procédure Plesk
1. **GitHub** → Push du projet (incluant les dossiers `dist/`)
2. **Plesk** → Pull depuis GitHub
3. **Plesk Node.js** → Configurer :
   - Application root: `/` (racine du projet)
   - Application startup file: `app.js`
   - Node.js version: 18+ (ou 20/22)
4. **Plesk** → Variables d'environnement à configurer :
   ```
   NODE_ENV=production
   PORT=(auto-assigné par Plesk)
   SUPABASE_DATABASE_URL=postgresql://postgres.tcgvodxxtbipghukgifv:kuLUu2FIpj42euRQ@aws-1-eu-west-2.pooler.supabase.com:6543/postgres
   SESSION_SECRET=<secret_long_et_aleatoire>
   PIXPAY_API_KEY_XAF=<votre_cle>
   PIXPAY_API_KEY_XOF=<votre_cle>
   PIXPAY_API_KEY_CDF=<votre_cle>
   ```
5. **Plesk** → Cliquer "Deploy Now" puis "Restart"
6. ✅ Le site est en ligne — **aucun npm install ni build requis**

### Pourquoi aucun install/build n'est nécessaire
- Le backend est bundlé par **esbuild** en un seul fichier `.mjs` (toutes les dépendances incluses)
- Le frontend est buildé par **Vite** en fichiers statiques dans `dist/public/`
- Express sert automatiquement les fichiers statiques ET l'API sur le même port

## Project Structure

```
app.js                          ← Entry point Plesk production
artifacts/
  api-server/src/
    routes/       auth.ts, wallets.ts, transactions.ts, dashboard.ts, admin.ts
                  nowpayments-ipn.ts
    middlewares/  authMiddleware.ts, rateLimitMiddleware.ts
    lib/          feeService.ts, providerService.ts, fxRates.ts, nowpayments.ts
                  migrations.ts
    app.ts        ← Sert aussi les fichiers statiques frontend en production
  yookpay/src/
    pages/        login, register, dashboard, deposit, withdraw, transfer, transactions
                  admin/index, admin/users, admin/kyc-queue, admin/exchanges, admin/conversion
                  admin/pixpay-config, admin/transactions, admin/user-detail
    lib/          auth.tsx (AuthProvider + JWT), format.ts
    components/   layout/dashboard-layout.tsx, yookpay-logo.tsx

lib/
  api-spec/openapi.yaml   — OpenAPI contract (source of truth)
  api-client-react/       — Generated React Query hooks
  api-zod/                — Generated Zod validation schemas
  db/src/schema/          — users.ts, wallets.ts, transactions.ts, cryptoExchanges.ts
```

## Important Code Patterns
- `customFetch` returns parsed JSON directly — never chain `.then(r => r.json())`
- Error display: strip `HTTP 4xx:` prefix with `/^HTTP\s+\d+\s+[^:]+:\s*/i`
- `modal={false}` always on `SelectContent` to prevent Android crash
- USDT wallet uses country code `"ZZ"` as placeholder in wallets table
- `crypto_exchanges` table tracks USDT exchange requests with STEP1_DONE/PENDING_ADMIN/COMPLETED/REJECTED states
- `locked_balance` column on wallets table for USDT→fiat pending reserves
- bcryptjs (pure JS) used instead of bcrypt (native) for esbuild bundling compatibility
- Express wildcard uses regex `/(.*)/ ` syntax (Express 5 compatible)
