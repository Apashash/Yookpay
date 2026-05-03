import { logger } from "./logger";

const PROD_BASE = "https://proxy-coreapi.pixelinnov.net/api_v1/transaction";
const SANDBOX_BASE = "https://standbox-api.pixelinnov.net/api_v1/transaction";

function getBaseUrl(): string {
  return process.env["PIXPAY_ENV"] === "production" ? PROD_BASE : SANDBOX_BASE;
}

export type OperatorFlow = "STANDARD" | "OTP" | "WAVE" | "QMONEY";

export function getOperatorFlow(operator: string): OperatorFlow {
  const op = operator.toUpperCase();
  if (op === "WAVE") return "WAVE";
  if (op === "QMONEY") return "QMONEY";
  if (op === "ORANGE") return "OTP";
  return "STANDARD";
}

export function getApiKey(currency: string): string {
  // Try currency-specific key first (e.g. PIXPAY_API_KEY_XAF), then universal fallback
  const specific = process.env[`PIXPAY_API_KEY_${currency.toUpperCase()}`];
  if (specific) return specific.trim();
  const universal = process.env["PIXPAY_API_KEY"];
  if (universal) return universal.trim();
  throw new Error(`Clé API PixPay manquante — définissez PIXPAY_API_KEY_${currency.toUpperCase()} ou PIXPAY_API_KEY`);
}

export function getIpnUrl(): string {
  const base =
    process.env["PIXPAY_IPN_BASE_URL"] ||
    (process.env["REPLIT_DOMAINS"]
      ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]!}`
      : "http://localhost:8080");
  return `${base}/api/ipn/pixpay`;
}

export type PixPayCallParams = {
  currency: string;
  serviceId: number;
  amount: number;
  phone: string;
  customData: string;
  omOtp?: string;
  businessNameId?: string;
  redirectUrl?: string;
  redirectErrorUrl?: string;
};

export type PixPayCallResult = {
  pixTransactionId: string;
  state: string;
  smsLink: string | null;
  message: string;
};

export async function callPixPayAirtime(params: PixPayCallParams): Promise<PixPayCallResult> {
  const apiKey = getApiKey(params.currency);
  const ipnUrl = getIpnUrl();

  const body: Record<string, unknown> = {
    amount: params.amount,
    api_key: apiKey,
    destination: params.phone,
    ipn_url: ipnUrl,
    service_id: params.serviceId,
    custom_data: params.customData,
  };

  if (params.omOtp) {
    body["om_otp"] = params.omOtp;
  }

  if (params.businessNameId) {
    body["business_name_id"] = params.businessNameId;
    body["redirect_url"] = params.redirectUrl ?? "";
    body["redirect_error_url"] = params.redirectErrorUrl ?? "";
  }

  const apiKeyHint = apiKey.length > 8 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : "***";
  logger.info(
    { serviceId: params.serviceId, currency: params.currency, amount: params.amount, destination: params.phone, apiKeyHint, customData: params.customData },
    "PixPay airtime call initiated"
  );

  const res = await fetch(`${getBaseUrl()}/airtime`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  const json = (await res.json()) as {
    data?: Record<string, unknown>;
    message?: string;
    statut_code?: number;
  };

  const data = json.data ?? {};
  const pixState = String(data["state"] ?? "").toUpperCase();
  const pixTransactionId = String(data["transaction_id"] ?? "");

  logger.info(
    { statusCode: res.status, pixpayStatus: json.statut_code, state: pixState, txId: pixTransactionId, pixpayMessage: json.message, pixpayData: json.data },
    "PixPay airtime response"
  );

  // PixPay sometimes returns HTTP 500 but still creates the transaction (with FAILED state)
  // In that case, we return the result with state=FAILED rather than throwing
  if (pixTransactionId && (pixState === "FAILED" || pixState === "REJECTED")) {
    logger.warn({ pixTransactionId, pixState, message: json.message }, "PixPay transaction created but immediately FAILED");
    return {
      pixTransactionId,
      state: pixState,
      smsLink: null,
      message: json.message ?? "Transaction échouée côté opérateur",
    };
  }

  // Hard error: no transaction_id was created at all
  if (!res.ok || json.statut_code === 500) {
    logger.error(
      { statusCode: res.status, pixpayStatutCode: json.statut_code, message: json.message, fullBody: json },
      "PixPay airtime hard error — no transaction created"
    );
    throw new Error(json.message ?? `PixPay API error: ${res.status}`);
  }

  return {
    pixTransactionId,
    state: pixState || "PENDING1",
    smsLink: data["sms_link"] ? String(data["sms_link"]) : null,
    message: json.message ?? "Transaction initiée",
  };
}

export type PixPayStatusResult = {
  transactionId: string;
  state: string;
  isSuccess: boolean;
  isFailed: boolean;
  isPending: boolean;
};

/**
 * Query PixPay for the current status of a transaction.
 * Endpoint: GET /api_v1/transaction/status?transaction_id=...&api_key=...
 */
export async function getPixPayTransactionStatus(
  pixTransactionId: string,
  currency: string,
): Promise<PixPayStatusResult | null> {
  const apiKey = getApiKey(currency);
  const baseUrl = getBaseUrl().replace("/transaction", "");
  const url = `${baseUrl}/transaction/status?transaction_id=${encodeURIComponent(pixTransactionId)}&api_key=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    const json = (await res.json()) as {
      data?: Record<string, unknown>;
      message?: string;
      statut_code?: number;
    };

    if (!res.ok) {
      logger.warn({ pixTransactionId, status: res.status }, "PixPay status check non-200");
      return null;
    }

    const data = json.data ?? {};
    const rawState = String(data["state"] ?? data["status"] ?? "").toUpperCase().trim();

    const isSuccess = ["SUCCESSFUL", "SUCCESS", "SUCCESSFULL", "COMPLETED"].includes(rawState);
    const isFailed  = ["FAILED", "REJECTED", "CANCELLED", "ERROR"].includes(rawState);

    logger.info({ pixTransactionId, rawState, isSuccess, isFailed }, "PixPay status check result");

    return {
      transactionId: pixTransactionId,
      state: rawState,
      isSuccess,
      isFailed,
      isPending: !isSuccess && !isFailed,
    };
  } catch (err) {
    logger.warn({ err, pixTransactionId }, "PixPay status check error");
    return null;
  }
}

export async function confirmQmoney(pixTransactionId: string, otp: string): Promise<void> {
  const confirmUrl =
    process.env["PIXPAY_ENV"] === "production"
      ? "https://proxy-coreapi.pixelinnov.net/api_v1/confirm/cashout/qmoney"
      : "https://standbox-api.pixelinnov.net/api_v1/confirm/cashout/qmoney";

  const res = await fetch(confirmUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transaction_id: pixTransactionId, otp }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(json.message ?? `Qmoney confirm error: ${res.status}`);
  }
}
