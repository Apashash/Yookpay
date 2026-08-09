---
name: Maviance SmobilPay Integration
description: Architecture and key decisions for the Maviance S3P v2 + e-nkap integration in YookPay
---

## S3P API flow (Mobile Money)
- 2-step: `POST /quotestd` (get payToken) → `POST /collectstd` (DEPOSIT) or `POST /cashin` (WITHDRAWAL)
- CASHOUT services = collect from customer = YookPay DEPOSIT → `/collectstd`
- CASHIN services  = disburse to customer = YookPay WITHDRAWAL → `/cashin`
- Status check: `GET /verifytx?payToken=...`

## Maviance staging service IDs (Cameroon XAF)
- MTN CM DEPOSIT (CASHOUT)    → service_id 20053
- MTN CM WITHDRAWAL (CASHIN)  → service_id 20052
- ORANGE CM DEPOSIT (CASHOUT) → service_id 30053
- ORANGE CM WITHDRAWAL (CASHIN) → service_id 30052
Stored in `maviance_services` table.

## HMAC auth
- Headers: X-Api-Key, X-HS-Date, X-Nonce, Authorization: HMAC {hex}
- Signature = HMAC-SHA256(secret, nonce + timestamp + body_or_empty) → hex
- Implemented in `artifacts/api-server/src/lib/maviance.ts`

## Provider selection
- Table `payment_provider_config(country, operator, type, provider)`
- Admin sets via `PUT /api/admin/provider-config` → `{country, operator, type, provider: "PIXPAY"|"MAVIANCE"}`
- Default is PIXPAY if no row exists (backward-compatible)
- Per-transaction provider stored in `metadata.provider`

## E-nkap (card collection)
- Uses `POST /collectcard` with a CARD service
- Returns `redirectUrl` for customer to complete payment
- IPN at `POST /api/ipn/enkap`
- Route: `POST /api/transactions/card-deposit`
- Card service IDs must be configured in `maviance_services` with type=CARD

## Required secrets
- MAVIANCE_PUBLIC_KEY (staging: 73cf144d-...)
- MAVIANCE_SECRET (staging: be5b2a0f-...)
- MAVIANCE_ENV = "staging" (default) or "production"

## Phone format
- Maviance expects international format without +: "237677389120" for Cameroon MTN
- PixPay expects local format with leading 0: "0677389120"
- `normalizeMaviancePhone()` in maviance.ts handles conversion

**Why provider-in-metadata:** Status polling (GET /transactions/:id) uses `metadata.provider` to decide whether to call PixPay or Maviance verifyTx — avoids needing a separate DB column.
