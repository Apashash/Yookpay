---
name: Maviance SmobilPay + e-nkap integration
description: S3P mobile-money flow, staging service IDs, HMAC auth, and the separate e-nkap card-payment API (OAuth2), provider selection, IPN hardening.
---

# Maviance S3P (mobile money)
- HMAC-signed API, base staging `https://s3p.smobilpay.staging.maviance.info/v2`. Staging creds only work on staging (prod returns HTML/error 4009 with them).
- Provider selection per country/operator via `payment_provider_config` table.
- Admin endpoint `POST /admin/maviance/sync-services` — fetches /service from Maviance API, auto-populates `maviance_services` table. **Field name quirk:** Maviance returns `serviceid` (not `id`), `localCur` (not `currency`), country as 3-letter ISO (CMR→CM, COG→CG, GAB→GA).
- Admin UI has "Sync Maviance" button (amber, Download icon) in the provider-config page toolbar.

# Staging service IDs (verified 2026-08-15 via /service endpoint)
**CASHIN (= YookPay WITHDRAWAL — send money to customer):**
- CM MTN: 20052 (MTN MoMo Cash in / Dépôt) — isReqServiceNumber=true
- CM Orange: 50052 (Orange Money Cash in / DEPOT) — isReqServiceNumber=true ← prefer this one
- CM Orange: 30052 (Orange Money Cash - In from Cash Collection) — isReqServiceNumber=false
- CG MTN: 100325 (MTN MoMo Cashin Congo)
- CG Airtel: 10068 (labeled CMR in API but is Congo)
- GA Moov: 202410 / GA Airtel: 202412

**CASHOUT (= YookPay DEPOSIT — collect from customer):**
- ⚠️ NONE in this staging account. Must request CASHOUT services from Maviance to do deposits.
- MTN CMR REMIT (7302) is CASHIN and Inactive.

# Key environment variables
- `MAVIANCE_ENV` — must be "staging" to use staging URL; "production" with staging creds causes Maviance to return HTML → frontend sees parse error.
- `MAVIANCE_PUBLIC_KEY`, `MAVIANCE_SECRET` — set as Replit secrets (staging values shared in message).
- `MAVIANCE_IPN_BASE_URL` — set to https://b.o.p.ashtechpay.top (their production domain).

# e-nkap (card payments) — SEPARATE API, not S3P
**Rule:** never use S3P `/collectcard`; card collection goes through e-nkap.
- Base staging `https://api.enkap-staging.maviance.info`; prod URL unconfirmed → override with `ENKAP_BASE_URL`; otherwise chosen by `MAVIANCE_ENV`.
- Auth: OAuth2 client_credentials `POST /token` (Basic consumerKey:consumerSecret) → bearer token (cached in memory). Env: `ENKAP_CONSUMER_KEY`/`ENKAP_CONSUMER_SECRET`.
- `POST /purchase/v1.2/api/order` → `{orderTransactionId, merchantReferenceId, redirectUrl}`; redirect the payer to `redirectUrl`.
- Status: `GET /purchase/v1.2/api/order/status?orderMerchantId=<merchantRef>`. **Why:** the live API returns `{"status":"CREATED"}` (field `status`, NOT `paymentStatus` as some docs show) — normalize both.
- Statuses: CREATED/INITIALISED/IN_PROGRESS → intermediate; CONFIRMED = success; FAILED/CANCELED = failure.
- ITN: `PUT <notificationUrl>/<merchantReference>` body `{status}` — **unsigned**. **Rule:** fail-closed — any final status (success or failure) from the ITN must be re-verified server-side against the status endpoint before touching the transaction/wallet; if verification is unavailable, ignore (e-nkap retries, polling picks it up).
- Currencies supported: XAF, CAD, EUR, GBP, USD, NGN.
- Staging e-nkap credentials (ENKAP_CONSUMER_KEY/SECRET) NOT yet provided by user.

# Card payment UI
- Deposit page (`artifacts/yookpay/src/pages/deposit.tsx`): "Carte" tab already exists (3-way toggle: Mobile/Carte/Crypto).
- Payment link page (`artifacts/yookpay/src/pages/pay.tsx`): card mode already exists.
- Both pages fully implemented — no UI work needed; only ENKAP credentials are missing.

# Testing recipe (Replit dev)
- Replit env has no MAVIANCE/ENKAP creds by default (they live on Plesk). For e2e tests: spin up throwaway MariaDB on port 3307 in /tmp, run built `dist/index.cjs` on PORT=9090 with env inline. **Background processes are reaped between ShellExec sessions — run DB start + server start + all curl tests in ONE shell command.**
- MariaDB grant gotcha: `'user'@'%'` doesn't cover localhost when the anonymous `''@'localhost'` user exists — create `'user'@'localhost'` too or delete anonymous users.
