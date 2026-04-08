// Admin-defined USDT exchange rates
// rate = 0 means "use live market rate from fxRates.ts"
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { convertCurrency } from "./fxRates";

export const USDT_PAIRS = ["USDT_XAF","XAF_USDT","USDT_XOF","XOF_USDT","USDT_CDF","CDF_USDT","EXCHANGE_FEE"] as const;
export type UsdtPair = typeof USDT_PAIRS[number];

export const DEFAULT_EXCHANGE_FEE = 0.02; // 2%

export async function getAllUsdtRates(): Promise<Record<string, number>> {
  const result = await db.execute(sql`SELECT pair, rate FROM usdt_rates ORDER BY pair`);
  const rates: Record<string, number> = {};
  for (const row of result.rows) {
    rates[(row as any).pair] = parseFloat((row as any).rate ?? "0");
  }
  return rates;
}

export async function getAdminRate(pair: string): Promise<number | null> {
  const result = await db.execute(sql`SELECT rate FROM usdt_rates WHERE pair = ${pair} LIMIT 1`);
  if (!result.rows.length) return null;
  const r = parseFloat((result.rows[0] as any).rate ?? "0");
  return r > 0 ? r : null;
}

export async function setUsdtRate(pair: string, rate: number): Promise<void> {
  await db.execute(sql`
    INSERT INTO usdt_rates (pair, rate, updated_at)
    VALUES (${pair}, ${rate}, NOW())
    ON CONFLICT (pair) DO UPDATE SET rate = ${rate}, updated_at = NOW()
  `);
}

// Resolve the best available rate for from→to:
// 1. Try direct pair (FROM_TO)
// 2. Try inverse pair (TO_FROM) and take 1/rate
// 3. Fall back to live FX
async function resolveRate(from: string, to: string): Promise<number | null> {
  const direct = await getAdminRate(`${from}_${to}`);
  if (direct !== null) return direct;
  const inverse = await getAdminRate(`${to}_${from}`);
  if (inverse !== null && inverse > 0) return 1 / inverse;
  return null;
}

// Convert using admin rate if set, otherwise fall back to live FX
export async function convertWithAdminRate(amount: number, from: string, to: string): Promise<number> {
  const rate = await resolveRate(from, to);
  if (rate !== null) return amount * rate;
  return convertCurrency(amount, from, to);
}

// Get the effective rate (admin or live) for 1 [from] → [to]
export async function getEffectiveRate(from: string, to: string): Promise<number> {
  const rate = await resolveRate(from, to);
  if (rate !== null) return rate;
  return convertCurrency(1, from, to);
}

// Get the admin-configured exchange fee rate (decimal), fallback 2%
export async function getExchangeFeeRate(): Promise<number> {
  const rate = await getAdminRate("EXCHANGE_FEE");
  return rate !== null ? rate : DEFAULT_EXCHANGE_FEE;
}
