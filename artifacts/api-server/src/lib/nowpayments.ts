import crypto from "crypto";

const BASE_URL = "https://api.nowpayments.io/v1";

function apiKey(): string {
  return process.env.NOWPAYMENTS_API_KEY ?? "";
}

// Obtain a short-lived JWT by logging in with NowPayments credentials
// Required for mass payouts only — stored in memory, refreshed per request
async function getNpJwt(): Promise<string> {
  const email    = process.env.NOWPAYMENTS_EMAIL    ?? "";
  const password = process.env.NOWPAYMENTS_PASSWORD ?? "";

  if (!email || !password) {
    throw new Error(
      "NOWPAYMENTS_EMAIL et NOWPAYMENTS_PASSWORD sont requis pour les retraits crypto. " +
      "Configurez ces secrets dans les paramètres."
    );
  }

  const res = await fetch(`${BASE_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const body = await res.json() as { token?: string; message?: string };
  if (!res.ok || !body.token) {
    throw new Error(
      `NowPayments auth failed ${res.status}: ${body.message ?? JSON.stringify(body)}`
    );
  }
  return body.token;
}

// Standard fetch with x-api-key (for deposits / payment creation)
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
    const msg = (body as { message?: string; error?: string })?.message
      ?? (body as { error?: string })?.error
      ?? JSON.stringify(body);
    throw new Error(`NowPayments API error ${res.status}: ${msg}`);
  }
  return body as T;
}

// Payout fetch — requires x-api-key + Bearer JWT (mass payouts)
async function npPayoutFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const key = apiKey();
  if (!key) throw new Error("NOWPAYMENTS_API_KEY non configurée");

  const jwt = await getNpJwt();

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "x-api-key": key,
      "Authorization": `Bearer ${jwt}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  const body = await res.json();
  if (!res.ok) {
    const msg = (body as { message?: string; error?: string })?.message
      ?? (body as { error?: string })?.error
      ?? JSON.stringify(body);
    throw new Error(`NowPayments Payout error ${res.status}: ${msg}`);
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
      price_amount:      params.priceAmount,
      price_currency:    params.priceCurrency,
      pay_currency:      params.payCurrency,
      order_id:          params.orderId,
      order_description: params.orderDescription,
      ipn_callback_url:  params.ipnCallbackUrl,
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

// ── Minimum payment amount ────────────────────────────────────────────────────
export async function getNpMinAmount(currencyFrom: string, currencyTo: string): Promise<number> {
  const data = await npFetch<{ min_amount: number }>(
    `/min-amount?currency_from=${currencyFrom}&currency_to=${currencyTo}`
  );
  return data.min_amount;
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
// Response shape from POST /v1/payout
export interface NpPayoutResponse {
  id: string;
  status: string;
  withdrawals: Array<{
    id: string;
    address: string;
    currency: string;
    amount: string;
    status: string;
    extra_id?: string;
  }>;
}

export async function createNpPayout(params: {
  address: string;
  amount: number;
  currency: string;   // e.g. "usdttrc20"
  ipnCallbackUrl: string;
  extraId?: string;
}): Promise<NpPayoutResponse> {
  const withdrawal: Record<string, unknown> = {
    address:          params.address,
    currency:         params.currency,
    amount:           params.amount,
    ipn_callback_url: params.ipnCallbackUrl,
  };
  if (params.extraId) withdrawal["extra_id"] = params.extraId;

  return npPayoutFetch<NpPayoutResponse>("/payout", {
    method: "POST",
    body: JSON.stringify({
      ipn_callback_url: params.ipnCallbackUrl,
      withdrawals: [withdrawal],
    }),
  });
}

// ── Get payout status ─────────────────────────────────────────────────────────
export async function getNpPayoutStatus(payoutId: string): Promise<NpPayoutResponse> {
  return npPayoutFetch<NpPayoutResponse>(`/payout/${payoutId}`);
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
