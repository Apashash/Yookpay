# YookPay - African Payment Platform

## Overview

YookPay is a premium fintech platform for African markets — a multi-currency mobile money aggregator supporting Cameroon (XAF), Senegal (XOF), and DRC (CDF). Built with a Stripe/PayPal-style design philosophy.

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
- **Mock provider service**: Simulates MTN, Orange, Moov, Wave with 92% success rate
- **Webhook support**: POST /api/transactions/webhook for async payment confirmation

### Frontend
- **UI style**: Dark fintech theme (navy + electric indigo accent), Inter font
- **Dashboard**: Wallet balances (XAF/XOF/CDF), 7-day volume chart, key stats, recent activity
- **Deposit form**: Country/operator selector with live fee preview
- **Withdrawal form**: Similar structure
- **Transfer**: Inter-wallet currency transfer
- **Transaction history**: Paginated table with status badges and filters
- **JWT auth**: Token stored in localStorage, setAuthTokenGetter wires all API calls

## Currency Map
- Cameroon (CM) → XAF
- Senegal (SN) → XOF
- DRC (CD) → CDF

## Operators
- MTN, ORANGE, MOOV, WAVE

## Demo Credentials
- Email: demo@yookpay.com
- Password: Demo1234!

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
    routes/       auth.ts, wallets.ts, transactions.ts, dashboard.ts
    middlewares/  authMiddleware.ts, rateLimitMiddleware.ts
    services/     feeService.ts, providerService.ts
  yookpay/src/
    pages/        login, register, dashboard, deposit, withdraw, transfer, transactions
    lib/          auth.tsx (AuthProvider + JWT), format.ts
    components/   layout/dashboard-layout.tsx

lib/
  api-spec/openapi.yaml   — OpenAPI contract (source of truth)
  api-client-react/       — Generated React Query hooks
  api-zod/                — Generated Zod validation schemas
  db/src/schema/          — users.ts, wallets.ts, transactions.ts
```
