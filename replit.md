# YookPay - African Payment Platform

## Overview

YookPay is a premium fintech platform for African markets — a multi-currency mobile money aggregator supporting Cameroon (XAF), Senegal (XOF), DRC (CDF), and USDT (crypto). Built with a Stripe/PayPal-style design philosophy.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + Shadcn/UI
- **Auth**: JWT (bcrypt + jsonwebtoken)
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

## Currency Map
- Cameroon (CM) → XAF (PixPay key: PIXPAY_API_KEY_XAF)
- Senegal (SN) → XOF (PixPay key: PIXPAY_API_KEY_XOF)
- DRC (CD) → CDF (PixPay key: PIXPAY_API_KEY_CDF)
- USDT (ZZ) → USDT via NowPayments

## Operators
- MTN, ORANGE, MOOV, WAVE

## Environment Variables (Secrets)
- `PIXPAY_API_KEY_CDF` — PixPay API key for CDF transactions
- `PIXPAY_API_KEY_XAF` — PixPay API key for XAF transactions
- `PIXPAY_API_KEY_XOF` — PixPay API key for XOF transactions
- `SESSION_SECRET` — JWT signing secret
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
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/yookpay run dev` — run frontend locally

## Project Structure

```
artifacts/
  api-server/src/
    routes/       auth.ts, wallets.ts, transactions.ts, dashboard.ts, admin.ts
                  nowpayments-ipn.ts
    middlewares/  authMiddleware.ts, rateLimitMiddleware.ts
    lib/          feeService.ts, providerService.ts, fxRates.ts, nowpayments.ts
                  migrations.ts
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
