---
name: Maviance SmobilPay + e-nkap integration
description: S3P mobile-money flow, staging service IDs, HMAC auth, and the separate e-nkap card-payment API (OAuth2), provider selection, IPN hardening.
---

# Maviance S3P (mobile money)
- HMAC-signed API, base staging `https://s3p.smobilpay.staging.maviance.info/v2`. Staging creds only work on staging (prod returns error 4009 with them).
- Provider selection per country/operator via `payment_provider_config` table.
- Countries offered (staging /service + test-data xlsx): Cameroun (MTN, Orange, EU, Yoomee — cashin+cashout), Congo-Brazzaville (MTN 100325, Airtel 10068 — cashin), Gabon (Moov 202410, Airtel 202412 — cashin), Tchad (Moov 600005/600006), RCA (Orange 600008/600009). Plus bills/topup CM (ENEO, Camwater, Canal+, DGI…).

# e-nkap (card payments) — SEPARATE API, not S3P
**Rule:** never use S3P `/collectcard`; card collection goes through e-nkap.
- Base staging `https://api.enkap-staging.maviance.info`; prod URL unconfirmed → override with `ENKAP_BASE_URL`; otherwise chosen by `MAVIANCE_ENV`.
- Auth: OAuth2 client_credentials `POST /token` (Basic consumerKey:consumerSecret) → bearer token (cached in memory). Env: `ENKAP_CONSUMER_KEY`/`ENKAP_CONSUMER_SECRET`.
- `POST /purchase/v1.2/api/order` → `{orderTransactionId, merchantReferenceId, redirectUrl}`; redirect the payer to `redirectUrl`.
- Status: `GET /purchase/v1.2/api/order/status?orderMerchantId=<merchantRef>`. **Why:** the live API returns `{"status":"CREATED"}` (field `status`, NOT `paymentStatus` as some docs show) — normalize both.
- Statuses: CREATED/INITIALISED/IN_PROGRESS → intermediate; CONFIRMED = success; FAILED/CANCELED = failure.
- ITN: `PUT <notificationUrl>/<merchantReference>` body `{status}` — **unsigned**. **Rule:** fail-closed — any final status (success or failure) from the ITN must be re-verified server-side against the status endpoint before touching the transaction/wallet; if verification is unavailable, ignore (e-nkap retries, polling picks it up).
- Currencies supported: XAF, CAD, EUR, GBP, USD, NGN.
- Staging example keys live in the user's Postman collection ("Enkap Staging").

# Testing recipe (Replit dev)
- Replit env has no MAVIANCE/ENKAP creds by default (they live on Plesk). For e2e tests: spin up throwaway MariaDB on port 3307 in /tmp, run built `dist/index.cjs` on PORT=9090 with env inline. **Background processes are reaped between ShellExec sessions — run DB start + server start + all curl tests in ONE shell command.**
- MariaDB grant gotcha: `'user'@'%'` doesn't cover localhost when the anonymous `''@'localhost'` user exists — create `'user'@'localhost'` too or delete anonymous users.
