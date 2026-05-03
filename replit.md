# YookPay - African Payment Platform

## Overview

YookPay is a premium fintech platform for African markets — a multi-currency mobile money aggregator supporting Cameroon (XAF), Senegal (XOF), DRC (CDF), and USDT (crypto). Built with a Stripe/PayPal-style design philosophy.

## Stack

- **Node.js version**: 24
- **Package manager**: pnpm (dev) / npm (Plesk production)
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: Supabase (PostgreSQL) + Drizzle ORM
- **Validation**: Zod, drizzle-zod
- **Build backend**: esbuild → `dist/index.cjs` (CJS, self-contained)
- **Build frontend**: Vite → `dist/public/`
- **Frontend**: React + Vite + Tailwind CSS + Shadcn/UI
- **Auth**: JWT (bcryptjs + jsonwebtoken)
- **Rate limiting**: express-rate-limit
- **HTTP logging**: pino + pino-http

## Project Structure

```
client/src/       ← Frontend React (source)
  App.tsx         ← Root router
  pages/          ← All pages
  components/     ← UI components
  lib/auth.tsx    ← AuthProvider + JWT
  lib/api/        ← Generated API client (React Query hooks)

server/           ← Backend Express (source)
  index.ts        ← Entry point (reads PORT, runs migrations)
  app.ts          ← Express app (routes + static frontend serving)
  routes/         ← API routes (auth, wallets, transactions, admin...)
  lib/            ← logger, migrations, pixpay, nowpayments, fxRates
  middlewares/    ← authMiddleware, adminMiddleware, rateLimitMiddleware
  services/       ← feeService, providerService

shared/           ← Shared between frontend and backend
  db.ts           ← Database connection (Drizzle + pg pool)
  schema/         ← Drizzle schema (users, wallets, transactions...)
  api-zod/        ← Generated Zod validation schemas

dist/             ← Production build output (committed to git)
  index.cjs       ← Backend bundle (Plesk startup file)
  public/         ← Frontend static files (served by Express)

build.mjs         ← esbuild config → dist/index.cjs
vite.config.ts    ← Vite config → dist/public/
```

## Key Features

### Backend
- **Rate limiting**: Global (200/15min), Auth (10/15min), Transactions (5/min per user)
- **Dynamic fee system**: Per-country, per-operator, per-type fee table
- **PixPay Innov API**: Real payment processing
- **NowPayments API**: USDT crypto deposits (TRC-20) and withdrawals
- **USDT Exchange**: Fiat→USDT (instant, 2% fee) and USDT→Fiat (admin approval)
- **FX Rates**: open.er-api.com (1h cache) with fallback rates
- **Webhook/IPN support**: POST /api/transactions/webhook + POST /api/nowpayments/ipn
- **Admin panel**: User management, KYC queue, PixPay config, Conversion rates, Exchanges
- **Static file serving**: Express serves `dist/public/` in production

### Frontend
- **UI style**: Dark fintech theme (navy + electric indigo), Inter font
- **Dashboard**: Wallet balances (XAF/XOF/CDF/USDT 4-column grid), 7-day volume chart
- **Deposit/Withdrawal**: Mobile Money + Crypto USDT tabs
- **Transfer**: Virement Interne + Échange USDT with 2-step stepper
- **JWT auth**: Token in localStorage, `setAuthTokenGetter` wires all API calls
- **French language interface**

## Database (Supabase)

- **Project URL**: https://tcgvodxxtbipghukgifv.supabase.co
- **Connection**: Transaction Pooler (port 6543)
- **Tables**: users, wallets, transactions, api_keys, kyc_documents, kyc_profiles, user_fees, user_operator_fees, crypto_exchanges, conversion_fees, pixpay_services, platform_config, notifications, payment_links, support_links, usdt_rates

## Environment Variables (Secrets)
- `SUPABASE_DATABASE_URL` — Supabase PostgreSQL connection string
- `SESSION_SECRET` — JWT signing secret
- `PIXPAY_API_KEY_CDF` — PixPay API key for CDF
- `PIXPAY_API_KEY_XAF` — PixPay API key for XAF
- `PIXPAY_API_KEY_XOF` — PixPay API key for XOF
- `NOWPAYMENTS_API_KEY` — NowPayments API key
- `NOWPAYMENTS_IPN_SECRET` — NowPayments IPN secret
- `APP_URL` — Public URL for IPN callbacks

## Demo / Admin Credentials
- Demo: demo@yookpay.com / Demo1234!
- Admin: Mfouapon0237@gmail.com

## Key Commands

```bash
npm run build:frontend   # Vite → dist/public/
npm run build:backend    # esbuild → dist/index.cjs
npm run build            # Both
npm start                # node dist/index.cjs (production)
pnpm --filter @workspace/db run push   # Push DB schema to Supabase
```

## Plesk Deployment

- **Startup file**: `dist/index.cjs`
- **No npm install needed** — dist/ is committed to git with all deps bundled
- See `PLESK_DEPLOY.md` for full guide

## Important Code Patterns
- `customFetch` returns parsed JSON directly — never chain `.then(r => r.json())`
- `@workspace/*` imports resolved via esbuild aliases (backend) and Vite aliases (frontend)
- bcryptjs (pure JS) used instead of bcrypt (native) for esbuild compatibility
- USDT wallet uses country code `"ZZ"` as placeholder
- `crypto_exchanges` table tracks USDT exchange with STEP1_DONE/PENDING_ADMIN/COMPLETED/REJECTED states
- Express wildcard uses regex `/^(?!\/api).*/` (Express 5 compatible)
