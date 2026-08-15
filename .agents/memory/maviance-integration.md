---
name: Maviance SmobilPay + e-nkap integration
description: S3P flow, correct service IDs per endpoint, HMAC auth, merchant→operator mapping, e-nkap card collection.
---

# Maviance S3P — critical endpoint distinction
- `GET /service`  → service METADATA (title, regex, hints) — service IDs here are CASHIN-only (20052, 30052…)
- `GET /cashout`  → pay items for DEPOSIT (collect FROM customer) — **different IDs**: 20053, 30053, 50053…
- `GET /cashin`   → pay items for WITHDRAWAL (disburse TO customer) — IDs: 20052, 30052, 50052…
- **NEVER use /service to get CASHOUT service IDs — they don't appear there.**

# Sync endpoint (POST /admin/maviance/sync-services)
- Calls `getPayItems("CASHOUT")` + `getPayItems("CASHIN")` in parallel (NOT getServiceList)
- Maps merchant code → {operator, country, currency} via MERCHANT_MAP in admin.ts
- Upserts into `maviance_services` with ON DUPLICATE KEY UPDATE
- Admin UI: "Sync Maviance" button (amber, Download icon) in provider-config toolbar

# Staging service IDs — verified 2026-08-15
**CASHOUT / DEPOSIT (collect FROM customer phone):**
- CM MTN:    20053  payItemId prefix S-112-949-MTNMOMO-20053
- CM ORANGE: 50053  payItemId prefix S-112-949-CMORANGEMOMO-50053  ← preferred (serviceNumber required)
- CM ORANGE: 30053  payItemId prefix S-112-949-CMORANGEOM-30053
- GA MOOV:   202411
- GA AIRTEL: 202413

**CASHIN / WITHDRAWAL (disburse TO customer phone):**
- CM MTN:    20052
- CM ORANGE: 50052  ← preferred
- CM ORANGE: 30052
- CG MTN:    100325
- CG AIRTEL: 10068
- GA MOOV:   202410
- GA AIRTEL: 202412

# Key env variables
- `MAVIANCE_ENV` = "staging" — MUST be staging with these creds; production URL with staging creds returns HTML
- `MAVIANCE_PUBLIC_KEY`, `MAVIANCE_SECRET` — set as Replit secrets
- `MAVIANCE_IPN_BASE_URL` = https://b.o.p.ashtechpay.top (production callback base)

# e-nkap (card payments)
- Separate OAuth2 API, NOT part of S3P. Base staging: https://api.enkap-staging.maviance.info
- Auth: POST /token with Basic(consumerKey:consumerSecret) → bearer token (cached in memory)
- POST /purchase/v1.2/api/order → {orderTransactionId, merchantReferenceId, redirectUrl}
- Status field is `status` (not `paymentStatus`). CONFIRMED = success, FAILED/CANCELED = failure.
- ITN: PUT <notificationUrl>/<merchantRef> — unsigned, must be re-verified server-side
- Credentials `ENKAP_CONSUMER_KEY`/`ENKAP_CONSUMER_SECRET` not yet provided by user

# Testing note
- Replit DB (172.24.0.3:3306) not reachable from Replit env — production DB on Plesk
- To test API calls: run node scripts with env vars directly (credentials available as Replit secrets)
