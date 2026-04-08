import crypto from "crypto";

const BASE_URL = "https://api.nowpayments.io/v1";

function apiKey(): string {
  return process.env.NOWPAYMENTS_API_KEY ?? "";
}

async function npFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const key = apiKey();
  if (!key) throw new Error("NOWPAYMENTS_API_KEY non configurée");

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "x-api-key": key,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  const body = await res.json();
  if (!res.ok) {
    const msg = body?.message ?? body?.error ?? JSON.stringify(body);
    throw new Error(`NowPayments API error ${res.status}: ${msg}`);
  }
  return body as T;
}

// ── Create a crypto payment (deposit) ────────────────────────────────────────
export interface NpPaymentResult {
  payment_id: string;
  pay_address: string;
  pay_amount: number;
  pay_currency: string;
  price_amount: number;
  price_currency: string;
  payment_status: string;
}

export async function createNpPayment(params: {
  priceAmount: number;
  priceCurrency: string;
  payCurrency: string;
  orderId: string;
  orderDescription: string;
  ipnCallbackUrl: string;
}): Promise<NpPaymentResult> {
  return npFetch<NpPaymentResult>("/payment", {
    method: "POST",
    body: JSON.stringify({
      price_amount:     params.priceAmount,
      price_currency:   params.priceCurrency,
      pay_currency:     params.payCurrency,
      order_id:         params.orderId,
      order_description: params.orderDescription,
      ipn_callback_url: params.ipnCallbackUrl,
    }),
  });
}

// ── Get payment status ────────────────────────────────────────────────────────
export interface NpPaymentStatus {
  payment_id: string;
  payment_status: string;
  pay_address: string;
  pay_currency: string;
  pay_amount: number;
  actually_paid: number;
  outcome_amount: number;
  outcome_currency: string;
  order_id: string | null;
}

export async function getNpPaymentStatus(paymentId: string): Promise<NpPaymentStatus> {
  return npFetch<NpPaymentStatus>(`/payment/${paymentId}`);
}

// ── Estimate: how much crypto for N USD ───────────────────────────────────────
export interface NpEstimate {
  currency_from: string;
  currency_to: string;
  amount: number;
  estimated_amount: number;
}

export async function getNpEstimate(params: {
  amount: number;
  currencyFrom: string;
  currencyTo: string;
}): Promise<NpEstimate> {
  return npFetch<NpEstimate>(
    `/estimate?amount=${params.amount}&currency_from=${params.currencyFrom}&currency_to=${params.currencyTo}`
  );
}

// ── Mass payout (crypto withdrawal) ──────────────────────────────────────────
export interface NpPayoutResult {
  id: string;
  status: string;
  currency: string;
  amount: string;
  address: string;
}

export async function createNpPayout(params: {
  address: string;
  amount: number;
  currency: string;
  ipnCallbackUrl: string;
  extraId?: string;
}): Promise<NpPayoutResult> {
  return npFetch<NpPayoutResult>("/payout", {
    method: "POST",
    body: JSON.stringify({
      address:          params.address,
      amount:           params.amount,
      currency:         params.currency,
      ipn_callback_url: params.ipnCallbackUrl,
      extra_id:         params.extraId,
    }),
  });
}

// ── IPN signature verification ────────────────────────────────────────────────
export function verifyNpIpnSignature(body: Record<string, unknown>, signature: string): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET ?? "";
  if (!secret) return false;

  function sortObject(obj: Record<string, unknown>): Record<string, unknown> {
    return Object.keys(obj).sort().reduce((acc, key) => {
      acc[key] = obj[key] && typeof obj[key] === "object" && !Array.isArray(obj[key])
        ? sortObject(obj[key] as Record<string, unknown>)
        : obj[key];
      return acc;
    }, {} as Record<string, unknown>);
  }

  const sorted = sortObject(body);
  const hmac = crypto.createHmac("sha512", secret);
  hmac.update(JSON.stringify(sorted));
  const computed = hmac.digest("hex");
  return computed === signature;
}
