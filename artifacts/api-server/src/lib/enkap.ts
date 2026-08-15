/**
 * Maviance e-nkap — card / multi-method hosted payment page (API séparée de S3P)
 *
 * Flow (doc E-nkap v1.2.2 + collection Postman "Enkap Staging") :
 *   1. POST {base}/token                          — OAuth2 client_credentials (Basic consumerKey:consumerSecret)
 *   2. POST {base}/purchase/v1.2/api/order        — enregistre la commande → { orderTransactionId, redirectUrl }
 *   3. Redirection du client vers redirectUrl (page de paiement e-nkap : carte Visa/Mastercard, etc.)
 *   4. ITN : PUT <notificationUrl>/<merchantReference> body { status }
 *   5. GET {base}/purchase/v1.2/api/order/status?orderMerchantId=<merchantReference> — vérification du statut
 *
 * Statuts : CREATED, INITIALISED, IN_PROGRESS, CONFIRMED (succès), FAILED, CANCELED
 * Devises supportées : XAF, CAD, EUR, GBP, USD, NGN
 */

import { logger } from "./logger";

const STAGING_BASE = "https://api.enkap-staging.maviance.info";
const PROD_BASE    = "https://api.enkap.maviance.info";

export function getEnkapBaseUrl(): string {
  const override = process.env["ENKAP_BASE_URL"];
  if (override) return override.replace(/\/+$/, "");
  return process.env["MAVIANCE_ENV"] === "production" ? PROD_BASE : STAGING_BASE;
}

function getEnkapCredentials(): { key: string; secret: string } {
  const key    = process.env["ENKAP_CONSUMER_KEY"];
  const secret = process.env["ENKAP_CONSUMER_SECRET"];
  if (!key || !secret) {
    throw new Error(
      "Clés e-nkap manquantes — définissez ENKAP_CONSUMER_KEY et ENKAP_CONSUMER_SECRET (Consumer Key/Secret du portail e-nkap)."
    );
  }
  return { key: key.trim(), secret: secret.trim() };
}

export class EnkapApiError extends Error {
  constructor(message: string, public httpStatus: number) {
    super(message);
    this.name = "EnkapApiError";
  }
}

// ─── OAuth token (cached in memory until near expiry) ────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }
  const { key, secret } = getEnkapCredentials();
  const res = await fetch(`${getEnkapBaseUrl()}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  if (!res.ok) {
    logger.error({ status: res.status, body: text.slice(0, 300) }, "e-nkap token error");
    throw new EnkapApiError(`e-nkap authentification échouée (HTTP ${res.status})`, res.status);
  }
  const json = JSON.parse(text) as { access_token: string; expires_in?: number };
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

async function enkapRequest<T>(
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const token = await getAccessToken();
  const url = `${getEnkapBaseUrl()}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  logger.info({ method, path, status: res.status, preview: text.slice(0, 300) }, "e-nkap response");
  if (!res.ok) {
    let msg = `Erreur e-nkap HTTP ${res.status}`;
    try {
      const j = JSON.parse(text) as { message?: string; description?: string; error_description?: string };
      msg = j.message ?? j.description ?? j.error_description ?? msg;
    } catch { /* keep default */ }
    throw new EnkapApiError(msg, res.status);
  }
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new EnkapApiError(`e-nkap réponse non-JSON: ${text.slice(0, 200)}`, res.status);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type EnkapPaymentStatus =
  | "CREATED" | "INITIALISED" | "IN_PROGRESS" | "CONFIRMED" | "FAILED" | "CANCELED";

export function isEnkapSuccess(status: string): boolean {
  return status.toUpperCase() === "CONFIRMED";
}
export function isEnkapFailed(status: string): boolean {
  const s = status.toUpperCase();
  return s === "FAILED" || s === "CANCELED" || s === "CANCELLED";
}

export interface EnkapOrderResult {
  orderTransactionId:  string;
  merchantReferenceId: string;
  redirectUrl:         string;
}

/** Place an order → returns hosted payment page redirectUrl */
export async function placeOrder(params: {
  amount:          number;
  currency:        string;   // XAF, CAD, EUR, GBP, USD, NGN
  merchantReference: string; // our transaction reference (≤36 chars) — used later for status query
  description:     string;
  customerName?:   string;
  email?:          string;
  phoneNumber?:    string;
  langKey?:        "en" | "fr";
  returnUrl?:      string;   // e-nkap appends /<reference>?status=...
  notificationUrl?: string;  // e-nkap calls PUT <url>/<reference> with { status }
}): Promise<EnkapOrderResult> {
  const body: Record<string, unknown> = {
    currency:          params.currency,
    totalAmount:       params.amount,
    merchantReference: params.merchantReference,
    description:       params.description.slice(0, 50),
    langKey:           params.langKey ?? "fr",
    items: [
      {
        itemId:      params.merchantReference.slice(0, 36),
        particulars: params.description.slice(0, 50),
        quantity:    1,
        unitCost:    params.amount,
        subTotal:    params.amount,
      },
    ],
  };
  if (params.customerName)    body["customerName"]    = params.customerName.slice(0, 50);
  if (params.email)           body["email"]           = params.email;
  if (params.phoneNumber)     body["phoneNumber"]     = params.phoneNumber;
  if (params.returnUrl)       body["returnUrl"]       = params.returnUrl;
  if (params.notificationUrl) body["notificationUrl"] = params.notificationUrl;

  logger.info(
    { ref: params.merchantReference, amount: params.amount, currency: params.currency },
    "e-nkap placeOrder"
  );
  return enkapRequest<EnkapOrderResult>("POST", "/purchase/v1.2/api/order", body);
}

export interface EnkapStatusResult {
  paymentStatus: EnkapPaymentStatus | string;
  [key: string]: unknown;
}

/** Query payment status by our merchant reference */
export async function getOrderStatusByReference(reference: string): Promise<EnkapStatusResult | null> {
  try {
    const raw = await enkapRequest<Record<string, unknown>>(
      "GET",
      `/purchase/v1.2/api/order/status?orderMerchantId=${encodeURIComponent(reference)}`,
    );
    if (!raw) return null;
    // The live API returns { "status": "CREATED" } while some docs show
    // { "paymentStatus": ... } — normalize both to paymentStatus.
    const st = raw["paymentStatus"] ?? raw["status"];
    return { ...raw, paymentStatus: typeof st === "string" ? st : "" } as EnkapStatusResult;
  } catch (err) {
    logger.warn({ err, reference }, "e-nkap status query error");
    return null;
  }
}

/** Configure account-level default return/notification URLs (optional) */
export async function setupCallbackUrls(returnUrl: string, notificationUrl: string): Promise<void> {
  await enkapRequest("PUT", "/purchase/v1.2/api/order/setup", { returnUrl, notificationUrl });
}
