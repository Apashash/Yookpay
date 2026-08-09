/**
 * Maviance SmobilPay S3P v2 — client with HMAC-SHA256 authentication
 *
 * Terminology (Maviance vs YookPay):
 *   CASHOUT service  + POST /collectstd  = collect from customer   = YookPay DEPOSIT
 *   CASHIN  service  + POST /cashin      = disburse to customer    = YookPay WITHDRAWAL
 *   CARD    service  + POST /collectcard = card collection          = YookPay CARD_DEPOSIT
 */

import { createHmac, randomBytes } from "crypto";
import { logger } from "./logger";

const STAGING_BASE = "https://s3p.smobilpay.staging.maviance.info/v2";
const PROD_BASE    = "https://s3p.smobilpay.maviance.info/v2";

export function getMavianceBaseUrl(): string {
  return process.env["MAVIANCE_ENV"] === "production" ? PROD_BASE : STAGING_BASE;
}

function getCredentials(): { publicKey: string; secret: string } {
  const publicKey = process.env["MAVIANCE_PUBLIC_KEY"];
  const secret    = process.env["MAVIANCE_SECRET"];
  if (!publicKey || !secret) {
    throw new Error(
      "Clés Maviance manquantes — définissez MAVIANCE_PUBLIC_KEY et MAVIANCE_SECRET dans les variables d'environnement."
    );
  }
  return { publicKey: publicKey.trim(), secret: secret.trim() };
}

/**
 * Build HMAC-SHA256 signed headers for Maviance S3P v2.
 * Signature = HMAC-SHA256(secret, nonce + timestamp + body_or_empty) → hex
 */
function buildHeaders(body: string = ""): Record<string, string> {
  const { publicKey, secret } = getCredentials();
  const timestamp = new Date().toISOString();
  const nonce     = randomBytes(16).toString("hex");
  const message   = nonce + timestamp + body;
  const signature = createHmac("sha256", secret).update(message).digest("hex");

  return {
    "Content-Type":  "application/json",
    "X-Api-Key":     publicKey,
    "X-HS-Date":     timestamp,
    "X-Nonce":       nonce,
    "Authorization": `HMAC ${signature}`,
  };
}

/** Generic authenticated request to the S3P API */
async function s3pRequest<T>(
  method: "GET" | "POST",
  endpoint: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const base    = getMavianceBaseUrl();
  const url     = `${base}${endpoint}`;
  const bodyStr = body ? JSON.stringify(body) : "";
  const headers = buildHeaders(method === "POST" ? bodyStr : "");

  logger.debug({ method, url, bodyLen: bodyStr.length }, "Maviance S3P request");

  const res = await fetch(url, {
    method,
    headers,
    body: method === "POST" ? bodyStr : undefined,
    signal: AbortSignal.timeout(30_000),
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    logger.error({ status: res.status, body: text.slice(0, 500) }, "Maviance non-JSON response");
    throw new Error(`Maviance réponse non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }

  logger.info(
    { status: res.status, endpoint, preview: text.slice(0, 400) },
    "Maviance S3P response"
  );

  if (!res.ok) {
    const err = json as { message?: string; description?: string; errorCode?: string };
    const msg = err.message ?? err.description ?? `Erreur Maviance HTTP ${res.status}`;
    throw new MavianceApiError(msg, res.status, (err as any).errorCode);
  }

  return json as T;
}

// ─── Error class ──────────────────────────────────────────────────────────────

export class MavianceApiError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly errorCode?: string,
  ) {
    super(message);
    this.name = "MavianceApiError";
  }
}

// ─── Response types ───────────────────────────────────────────────────────────

export interface MavianceService {
  id:           number;
  merchant:     string;
  title:        string;
  type:         "CASHOUT" | "CASHIN" | "CARD" | "TOPUP" | "SUBSCRIPTION" | "PRODUCT" | "SEARCHABLE_BILL";
  amountType?:  string;
  description?: string;
  currency?:    string;
}

export interface MavianceQuote {
  quoteId?:  string;
  payToken:  string;
  amount:    number;
  fees:      number;
  currency:  string;
  service?:  string;
  expiry?:   string;
}

export interface MavianceCollectResult {
  payToken:           string;
  status:             string;
  trid?:              string;
  processingNumber?:  string;
  message?:           string;
}

export interface MavianceVerifyResult {
  payToken:   string;
  status:     "NEW" | "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "EXPIRED" | string;
  amount?:    number;
  fees?:      number;
  currency?:  string;
  trid?:      string;
  errorCode?: string;
  message?:   string;
}

export interface MavianceCardResult {
  payToken:    string;
  redirectUrl: string;
  status:      string;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

export function isMavianceSuccess(status: string): boolean {
  return ["SUCCESS", "SUCCESSFUL", "SUCCESSFULL", "COMPLETED"].includes(status.toUpperCase());
}

export function isMavianceFailed(status: string): boolean {
  return ["FAILED", "CANCELLED", "EXPIRED", "REJECTED", "ERROR"].includes(status.toUpperCase());
}

export function getMavianceIpnUrl(path: string): string {
  const base =
    process.env["MAVIANCE_IPN_BASE_URL"] ||
    (process.env["REPLIT_DOMAINS"]
      ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]!}`
      : "http://localhost:8080");
  return `${base}${path}`;
}

/**
 * Normalize phone to Maviance format: country-code-prefixed digits, no '+' or spaces.
 * E.g. Cameroon: "677389120" or "0677389120" → "237677389120"
 */
export function normalizeMaviancePhone(phone: string, country: string): string {
  const DIAL_CODES: Record<string, string> = {
    CM: "237", CI: "225", SN: "221", BF: "226",
    CD: "243", CG: "242", GA: "241", GN: "224",
    ML: "223", TG: "228", BJ: "229",
  };
  const dialCode = DIAL_CODES[country.toUpperCase()] ?? "";
  const digits   = phone.replace(/\D/g, "");
  if (!dialCode) return digits;
  if (digits.startsWith(dialCode)) return digits;
  return dialCode + digits.replace(/^0+/, "");
}

// ─── S3P API calls ────────────────────────────────────────────────────────────

export async function getServiceList(type: string): Promise<MavianceService[]> {
  return s3pRequest<MavianceService[]>("GET", `/servicelist?type=${type}`);
}

export async function createQuote(
  serviceId: number,
  amount: number,
  currency: string,
): Promise<MavianceQuote> {
  return s3pRequest<MavianceQuote>("POST", "/quotestd", {
    serviceid: serviceId,
    amount,
    currency:  currency.toUpperCase(),
  });
}

/** Collect cash from customer (CASHOUT service) → YookPay DEPOSIT */
export async function collectStd(
  payToken: string,
  phone: string,
  trid: string,
): Promise<MavianceCollectResult> {
  return s3pRequest<MavianceCollectResult>("POST", "/collectstd", {
    payToken,
    phonenumber:       phone,
    trid,
    processing_number: phone,
  });
}

/** Cash-in to customer phone (CASHIN service) → YookPay WITHDRAWAL */
export async function cashin(
  payToken: string,
  phone: string,
  trid: string,
): Promise<MavianceCollectResult> {
  return s3pRequest<MavianceCollectResult>("POST", "/cashin", {
    payToken,
    phonenumber: phone,
    trid,
  });
}

/** Card collection (CARD service) → returns hosted payment redirect URL */
export async function collectCard(
  payToken: string,
  redirectUrl: string,
  cancelUrl?: string,
): Promise<MavianceCardResult> {
  return s3pRequest<MavianceCardResult>("POST", "/collectcard", {
    payToken,
    redirectUrl,
    cancelUrl: cancelUrl ?? redirectUrl,
  });
}

export async function verifyTx(payToken: string): Promise<MavianceVerifyResult | null> {
  try {
    return await s3pRequest<MavianceVerifyResult>(
      "GET",
      `/verifytx?payToken=${encodeURIComponent(payToken)}`,
    );
  } catch (err) {
    logger.warn({ err, payToken }, "Maviance verifyTx error");
    return null;
  }
}

// ─── High-level flows ─────────────────────────────────────────────────────────

export async function initiateDeposit(params: {
  serviceId: number;
  amount:    number;
  currency:  string;
  phone:     string;
  trid:      string;
}): Promise<{ payToken: string; quote: MavianceQuote; collect: MavianceCollectResult }> {
  const hint = (process.env["MAVIANCE_PUBLIC_KEY"] ?? "").slice(0, 6) + "...";
  logger.info(
    { ...params, phone: params.phone.replace(/\d(?=\d{4})/g, "*"), env: process.env["MAVIANCE_ENV"] ?? "staging", hint },
    "Maviance DEPOSIT: quote → collectstd"
  );
  const quote   = await createQuote(params.serviceId, params.amount, params.currency);
  const collect = await collectStd(quote.payToken, params.phone, params.trid);
  logger.info({ payToken: quote.payToken, status: collect.status, trid: params.trid }, "Maviance DEPOSIT done");
  return { payToken: quote.payToken, quote, collect };
}

export async function initiateWithdrawal(params: {
  serviceId: number;
  amount:    number;
  currency:  string;
  phone:     string;
  trid:      string;
}): Promise<{ payToken: string; quote: MavianceQuote; collect: MavianceCollectResult }> {
  logger.info(
    { ...params, phone: params.phone.replace(/\d(?=\d{4})/g, "*") },
    "Maviance WITHDRAWAL: quote → cashin"
  );
  const quote   = await createQuote(params.serviceId, params.amount, params.currency);
  const collect = await cashin(quote.payToken, params.phone, params.trid);
  logger.info({ payToken: quote.payToken, status: collect.status, trid: params.trid }, "Maviance WITHDRAWAL done");
  return { payToken: quote.payToken, quote, collect };
}

export async function initiateCardDeposit(params: {
  serviceId:   number;
  amount:      number;
  currency:    string;
  trid:        string;
  redirectUrl: string;
  cancelUrl?:  string;
}): Promise<{ payToken: string; quote: MavianceQuote; redirectUrl: string }> {
  logger.info(params, "Maviance CARD DEPOSIT: quote → collectcard");
  const quote  = await createQuote(params.serviceId, params.amount, params.currency);
  const result = await collectCard(quote.payToken, params.redirectUrl, params.cancelUrl);
  logger.info({ payToken: quote.payToken, redirectUrl: result.redirectUrl }, "Maviance CARD done");
  return { payToken: quote.payToken, quote, redirectUrl: result.redirectUrl };
}
