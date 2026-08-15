/**
 * Maviance SmobilPay S3P v2 — client with HMAC-SHA1 authentication
 *
 * Terminology (Maviance vs YookPay):
 *   CASHOUT service  + POST /collectstd  = collect from customer   = YookPay DEPOSIT
 *   CASHIN  service  + POST /collectstd = disburse to customer    = YookPay WITHDRAWAL
 *   CARD    service  + POST /collectcard = card collection          = YookPay CARD_DEPOSIT
 */

import { createHmac } from "crypto";
import { logger } from "./logger";

const STAGING_BASE = "https://s3p.smobilpay.staging.maviance.info/v2";
const PROD_BASE    = "https://s3pv2cm.smobilpay.com/v2";

export function getMavianceBaseUrl(): string {
  return process.env["MAVIANCE_ENV"]?.toLowerCase() === "production" ? PROD_BASE : STAGING_BASE;
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
 * Build the s3pAuth header used by the Maviance Postman collection.
 * Signature = Base64(HMAC-SHA1(secret, METHOD & encoded URL & encoded sorted params)).
 */
function buildHeaders(
  method: "GET" | "POST",
  endpoint: string,
  body?: Record<string, unknown>,
): Record<string, string> {
  const { publicKey, secret } = getCredentials();
  const url = new URL(`${getMavianceBaseUrl()}${endpoint}`);
  const query: Record<string, unknown> = {};
  for (const [key, value] of url.searchParams.entries()) query[key] = value;

  // This is the signing algorithm from Maviance's supplied Postman collection.
  // The request body fields and query fields are signed together with the auth
  // fields, sorted lexicographically.
  const timestamp = Date.now();
  const nonce = Date.now();
  const authParams: Record<string, unknown> = {
    s3pAuth_nonce: nonce,
    s3pAuth_timestamp: timestamp,
    s3pAuth_signature_method: "HMAC-SHA1",
    s3pAuth_token: publicKey,
  };
  const params = { ...query, ...(body ?? {}), ...authParams };
  const parameterString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${typeof params[key] === "string" ? String(params[key]).trim() : params[key]}`)
    .join("&");
  // Postman signs the API URL including /v2 exactly once, without the query
  // string. `url.pathname` already contains /v2, so do not prepend `base`
  // here or the signature becomes invalid (`/v2/v2/...`).
  const signingUrl = `${url.origin}${url.pathname}`;
  const baseString = `${method}&${encodeURIComponent(signingUrl)}&${encodeURIComponent(parameterString)}`;
  const encodedSignature = createHmac("sha1", secret).update(baseString).digest("base64");
  const separator = ", ";

  return {
    "Content-Type": "application/json",
    Authorization:
      `s3pAuth s3pAuth_timestamp="${timestamp}"${separator}` +
      `s3pAuth_signature="${encodedSignature}"${separator}` +
      `s3pAuth_nonce="${nonce}"${separator}` +
      `s3pAuth_signature_method="HMAC-SHA1"${separator}` +
      `s3pAuth_token="${publicKey}"`,
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
  const headers = buildHeaders(method, endpoint, body);

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
    const err = json as {
      message?: string;
      description?: string;
      usrMsg?: string;
      devMsg?: string;
      errorCode?: string;
      respCode?: string | number;
    };
    const msg =
      err.message ??
      err.description ??
      err.usrMsg ??
      err.devMsg ??
      `Erreur Maviance HTTP ${res.status}`;
    throw new MavianceApiError(
      msg,
      res.status,
      err.errorCode ?? (err.respCode != null ? String(err.respCode) : undefined),
    );
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
    super(errorCode ? `${message} (code Maviance: ${errorCode})` : message);
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
  quoteId:   string;
  payToken?: string;
  amount:    number;
  fees:      number;
  currency:  string;
  service?:  string;
  expiry?:   string;
  [key: string]: unknown;
}

export interface MavianceCollectResult {
  payToken?:          string;
  quoteId?:           string;
  ptn?:               string;
  status:             string;
  trid?:              string;
  processingNumber?:   string;
  transactionId?:      string;
  errorCode?:          string;
  message?:            string;
  [key: string]: unknown;
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
  return ["FAILED", "CANCELLED", "EXPIRED", "REJECTED", "ERROR", "ERRORED", "REVERSED"].includes(status.toUpperCase());
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

/**
 * Maviance's serviceNumber is the operator-local subscriber number.
 * Unlike customerPhonenumber, it must not include the country dial code
 * or a leading local zero (e.g. 677389120, not 237677389120 or 0677389120).
 */
export function normalizeMavianceServiceNumber(phone: string, country: string): string {
  const international = normalizeMaviancePhone(phone, country);
  const DIAL_CODES: Record<string, string> = {
    BJ: "229", BF: "226", CM: "237", CD: "243", CG: "242",
    CI: "225", GA: "241", GM: "220", GN: "224", ML: "223",
    SN: "221", TG: "228",
  };
  const dialCode = DIAL_CODES[country.toUpperCase()] ?? "";
  const local = dialCode && international.startsWith(dialCode)
    ? international.slice(dialCode.length)
    : international;
  return local.replace(/^0+/, "");
}

// ─── S3P API calls ────────────────────────────────────────────────────────────

export async function getServiceList(type?: string): Promise<MavianceService[]> {
  const response = await s3pRequest<unknown>("GET", "/service");
  const raw = Array.isArray(response)
    ? response
    : ((response as any)?.data ?? (response as any)?.services ?? (response as any)?.result ?? []);
  const services = Array.isArray(raw) ? raw : [];
  if (!type) return services as MavianceService[];
  return services.filter((service: any) =>
    String(service.type ?? service.serviceType ?? "").toUpperCase() === type.toUpperCase()
  ) as MavianceService[];
}

export interface MaviancePayItem {
  payItemId:  string;
  serviceid:  string;
  merchant:   string;
  amountType: string;
  [key: string]: unknown;
}

/**
 * Retrieve all available pay items for a given operation type.
 * GET /cashout  → items usable for DEPOSIT  (collect FROM customer mobile wallet)
 * GET /cashin   → items usable for WITHDRAWAL (disburse TO customer mobile wallet)
 *
 * These endpoints return different service IDs from /service:
 *   e.g. MTN CM CASHOUT serviceid=20053 vs MTN CM CASHIN serviceid=20052
 */
export async function getPayItems(operation: "CASHOUT" | "CASHIN"): Promise<MaviancePayItem[]> {
  const response = await s3pRequest<unknown>("GET", `/${operation.toLowerCase()}`);
  const raw = Array.isArray(response)
    ? response
    : ((response as any)?.data ?? (response as any)?.items ?? (response as any)?.result ?? []);
  return (Array.isArray(raw) ? raw : []) as MaviancePayItem[];
}

type MavianceOperation = "CASHIN" | "CASHOUT";

async function getPayItemId(serviceId: number, operation: MavianceOperation): Promise<string> {
  const response = await s3pRequest<unknown>(
    "GET",
    `/${operation.toLowerCase()}?serviceid=${encodeURIComponent(serviceId)}`,
  );
  const raw = Array.isArray(response)
    ? response
    : ((response as any)?.data ?? (response as any)?.services ?? (response as any)?.result ?? response);
  const items = Array.isArray(raw) ? raw : [raw];
  const item = items.find((candidate: any) =>
    candidate && (candidate.payItemId || candidate.payitemid || candidate.payItemValue)
  );
  const payItemId = item?.payItemId ?? item?.payitemid ?? item?.payItemValue;
  if (!payItemId) {
    throw new MavianceApiError(
      `Aucun payItemId retourné pour le service Maviance ${serviceId} (${operation})`,
      502,
    );
  }
  return String(payItemId);
}

export async function createQuote(
  serviceId: number,
  amount: number,
  currency: string,
  operation: MavianceOperation = "CASHOUT",
): Promise<MavianceQuote> {
  const response = await s3pRequest<Record<string, unknown>>("POST", "/quotestd", {
    payItemId: await getPayItemId(serviceId, operation),
    amount,
  });
  const quoteId = String(response.quoteId ?? response.payToken ?? response.ptn ?? "");
  if (!quoteId) {
    throw new MavianceApiError("Maviance n'a pas retourné de quoteId", 502);
  }

  return {
    ...response,
    quoteId,
    payToken: response.payToken ? String(response.payToken) : undefined,
    amount: Number(response.amount ?? response.amountLocalCur ?? response.priceLocalCur ?? amount),
    fees: Number(response.fees ?? response.fee ?? 0),
    currency: String(response.currency ?? response.localCur ?? currency),
    expiry: response.expiry
      ? String(response.expiry)
      : response.expiresAt
        ? String(response.expiresAt)
        : undefined,
  };
}

/** Collect cash from customer (CASHOUT service) → YookPay DEPOSIT */
export async function collectStd(
  quoteId: string,
  phone: string,
  trid: string,
  serviceNumber: string,
): Promise<MavianceCollectResult> {
  return s3pRequest<MavianceCollectResult>("POST", "/collectstd", {
    quoteId,
    customerPhonenumber: phone,
    customerEmailaddress: "support@yookpay.com",
    customerName: "YookPay Customer",
    customerAddress: "YookPay",
    serviceNumber,
    trid,
  });
}

/**
 * Cash-in to customer phone (CASHIN service) → YookPay WITHDRAWAL.
 *
 * The supplied Maviance Postman collection uses GET /cashin only to retrieve
 * the payItemId. Execution is POST /collectstd for both CASHOUT and CASHIN.
 */
export async function cashin(
  quoteId: string,
  phone: string,
  trid: string,
  serviceNumber: string,
): Promise<MavianceCollectResult> {
  return s3pRequest<MavianceCollectResult>("POST", "/collectstd", {
    quoteId,
    customerPhonenumber: phone,
    customerEmailaddress: "support@yookpay.com",
    customerName: "YookPay Customer",
    customerAddress: "YookPay",
    serviceNumber,
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

export async function verifyTx(trid: string): Promise<MavianceVerifyResult | null> {
  try {
    return await s3pRequest<MavianceVerifyResult>(
      "GET",
      `/verifytx?trid=${encodeURIComponent(trid)}`,
    );
  } catch (err) {
    logger.warn({ err, trid }, "Maviance verifyTx error");
    return null;
  }
}

// ─── High-level flows ─────────────────────────────────────────────────────────

export async function initiateDeposit(params: {
  serviceId: number;
  amount:    number;
  currency:  string;
  phone:     string;
  serviceNumber?: string;
  trid:      string;
}): Promise<{ payToken: string; quote: MavianceQuote; collect: MavianceCollectResult }> {
  const hint = (process.env["MAVIANCE_PUBLIC_KEY"] ?? "").slice(0, 6) + "...";
  logger.info(
    { ...params, phone: params.phone.replace(/\d(?=\d{4})/g, "*"), env: process.env["MAVIANCE_ENV"] ?? "staging", hint },
    "Maviance DEPOSIT: quote → collectstd"
  );
  const quote   = await createQuote(params.serviceId, params.amount, params.currency, "CASHOUT");
  const collect = await collectStd(
    quote.quoteId,
    params.phone,
    params.trid,
    params.serviceNumber ?? params.phone.replace(/^0+/, ""),
  );
  logger.info({ quoteId: quote.quoteId, status: collect.status, trid: params.trid }, "Maviance DEPOSIT done");
  return { payToken: quote.quoteId, quote, collect };
}

export async function initiateWithdrawal(params: {
  serviceId: number;
  amount:    number;
  currency:  string;
  phone:     string;
  serviceNumber?: string;
  trid:      string;
}): Promise<{ payToken: string; quote: MavianceQuote; collect: MavianceCollectResult }> {
  logger.info(
    { ...params, phone: params.phone.replace(/\d(?=\d{4})/g, "*") },
    "Maviance WITHDRAWAL: quote → collectstd"
  );
  const quote   = await createQuote(params.serviceId, params.amount, params.currency, "CASHIN");
  const collect = await cashin(
    quote.quoteId,
    params.phone,
    params.trid,
    params.serviceNumber ?? params.phone.replace(/^0+/, ""),
  );
  logger.info({ quoteId: quote.quoteId, status: collect.status, trid: params.trid }, "Maviance WITHDRAWAL done");
  return { payToken: quote.quoteId, quote, collect };
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
  const quote  = await createQuote(params.serviceId, params.amount, params.currency, "CASHOUT");
  const result = await collectCard(quote.quoteId, params.redirectUrl, params.cancelUrl);
  logger.info({ quoteId: quote.quoteId, redirectUrl: result.redirectUrl }, "Maviance CARD done");
  return { payToken: quote.quoteId, quote, redirectUrl: result.redirectUrl };
}
