// Admin-defined USDT exchange rates
// rate = 0 means "use live market rate from fxRates.ts"
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { convertCurrency } from "./fxRates";

export const USDT_PAIRS = ["USDT_XAF","XAF_USDT","USDT_XOF","XOF_USDT","USDT_CDF","CDF_USDT"] as const;
export type UsdtPair = typeof USDT_PAIRS[number];

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

// Convert using admin rate if set, otherwise fall back to live FX
export async function convertWithAdminRate(amount: number, from: string, to: string): Promise<number> {
  const pair = `${from}_${to}`;
  const adminRate = await getAdminRate(pair);
  if (adminRate !== null) {
    // adminRate = how many [to] per 1 [from]
    return amount * adminRate;
  }
  return convertCurrency(amount, from, to);
}

// Get the effective rate (admin or live) for 1 [from] → [to]
export async function getEffectiveRate(from: string, to: string): Promise<number> {
  const pair = `${from}_${to}`;
  const adminRate = await getAdminRate(pair);
  if (adminRate !== null) return adminRate;
  const converted = await convertCurrency(1, from, to);
  return converted;
}
