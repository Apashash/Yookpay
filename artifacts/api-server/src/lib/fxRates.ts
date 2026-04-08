// FX rate helper — USD base rate fetched from open.er-api.com (no key required)
// Fallback to hardcoded rates if the API is unavailable.

const FALLBACK_RATES: Record<string, number> = {
  XAF: 600,
  XOF: 600,
  CDF: 2800,
  USDT: 1,
  USD: 1,
};

let cachedRates: Record<string, number> | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchRates(): Promise<Record<string, number>> {
  if (cachedRates && Date.now() < cacheExpiry) return cachedRates;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error("FX API error");
    const data = await res.json() as { rates: Record<string, number> };
    cachedRates = { ...data.rates, USDT: 1, USD: 1 };
    cacheExpiry = Date.now() + CACHE_TTL_MS;
    return cachedRates;
  } catch {
    return FALLBACK_RATES;
  }
}

// Convert amount from one currency to another via USD
export async function convertCurrency(amount: number, from: string, to: string): Promise<number> {
  const rates = await fetchRates();
  const fromRate = rates[from] ?? FALLBACK_RATES[from] ?? 1;
  const toRate   = rates[to]   ?? FALLBACK_RATES[to]   ?? 1;
  // amount (from) → USD → to
  const inUsd  = amount / fromRate;
  return inUsd * toRate;
}

// Get rate: 1 USD = N (currency)
export async function getRateFromUsd(currency: string): Promise<number> {
  const rates = await fetchRates();
  return rates[currency] ?? FALLBACK_RATES[currency] ?? 1;
}

// Get USD value of amount
export async function toUsd(amount: number, currency: string): Promise<number> {
  const rate = await getRateFromUsd(currency);
  return amount / rate;
}

// Minimum exchange amounts in each currency (16,000 XAF equivalent)
const MIN_XAF_EQUIV = 16000;
export async function getMinExchangeAmount(currency: string): Promise<number> {
  const result = await convertCurrency(MIN_XAF_EQUIV, "XAF", currency);
  return Math.ceil(result);
}
