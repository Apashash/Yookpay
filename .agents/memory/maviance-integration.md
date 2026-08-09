---
name: Maviance SmobilPay Integration
description: Architecture and key decisions for the Maviance S3P v2 + e-nkap integration in YookPay
---

## S3P API flow (Mobile Money)
- 2-step: `POST /quotestd` (get quoteId) → `POST /collectstd` (DEPOSIT) or `POST /cashin` (WITHDRAWAL)
- CASHOUT services = collect from customer = YookPay DEPOSIT → `/collectstd`
- CASHIN services  = disburse to customer = YookPay WITHDRAWAL → `/cashin`
- Status check: `GET /verifytx?trid=...`

## Maviance staging service IDs (Cameroon XAF)
- MTN CM DEPOSIT (CASHOUT)    → service_id 20053
- MTN CM WITHDRAWAL (CASHIN)  → service_id 20052
- ORANGE CM DEPOSIT (CASHOUT) → service_id 30053
- ORANGE CM WITHDRAWAL (CASHIN) → service_id 30052
Stored in `maviance_services` table.

## S3P authentication
- The supplied Postman collections use `Authorization: s3pAuth ...` with timestamp, nonce, signature method and token fields.
- Signature = Base64(HMAC-SHA1(secret, METHOD + encoded URL + encoded sorted parameters)).
- Production base URL from the supplied collection: `https://s3pv2cm.smobilpay.com/v2`; staging remains `https://s3p.smobilpay.staging.maviance.info/v2`.
- `GET /service` lists live services; `GET /cashout?serviceid=...` and `/cashin?serviceid=...` return payItemIds used by `/quotestd`.

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
- Maviance `serviceNumber` expects the local subscriber number without country code or leading zero: "677389120"
- PixPay expects local format with leading 0: "0677389120"
- `normalizeMaviancePhone()` in maviance.ts handles conversion

**Why provider-in-metadata:** Status polling (GET /transactions/:id) uses `metadata.provider` to decide whether to call PixPay or Maviance verifyTx — avoids needing a separate DB column.

## Runtime diagnostics
- The admin ENV diagnostic reports the Maviance environment, selected API base URL, callback URL, and whether the two credentials are present in the running Node process.
- On Plesk, adding variables is not enough: the Node application must be restarted before `process.env` reflects the new values.

## Environment and payload compatibility
- The supplied credentials authenticate successfully against the staging API, not the production API. Production returns S3P error `4009` ("Access token invalid") with those credentials.
- The staging `POST /quotestd` response uses `quoteId`; execution calls use that `quoteId` plus `customerPhonenumber`, `customerEmailaddress`, `customerName`, `customerAddress`, `serviceNumber`, and `trid`.
- Maviance status verification uses the integrator `trid` query parameter. Do not treat the quote identifier as the transaction status identifier.

**Why:** A production/staging mismatch and assuming a `payToken` response shape caused authentication and execution failures during the first live deposit test.

**How to apply:** Keep test deployments on `MAVIANCE_ENV=staging` until production credentials are issued, and validate the complete quote → execution → `verifytx?trid=...` flow against the current Postman collection.

## Payment links
- Public payment-link mobile payments must use the same `payment_provider_config` route selection as authenticated deposits; they must not call PixPay directly.

**Why:** The public payment-link endpoint originally bypassed provider configuration, so switching an operator to Maviance affected standard deposits but not payment links.

**How to apply:** For payment-link deposits, select the provider by country/operator/DEPOSIT, store it in transaction metadata, and poll Maviance with the transaction `trid`.
