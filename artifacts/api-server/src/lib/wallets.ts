import { db } from "@workspace/db";
import { walletsTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

/**
 * Wallets are scoped to a currency jurisdiction.  Do not look up a fiat wallet
 * by currency alone: XAF/XOF/CDF may be held separately for each country.
 */
export function walletCountry(currency: string, country?: string | null): string {
  return currency.toUpperCase() === "USDT" ? "ZZ" : (country ?? "").toUpperCase();
}

export async function getOrCreateWallet(userId: number, currency: string, country?: string | null) {
  const normalizedCurrency = currency.toUpperCase();
  const normalizedCountry = walletCountry(normalizedCurrency, country);
  if (!normalizedCountry) throw new Error("A country is required for a fiat wallet");

  // The database unique key makes this safe when payment initiation/IPNs race.
  await db.execute(sql`
    INSERT IGNORE INTO wallets (user_id, currency, country, balance, locked_balance)
    VALUES (${userId}, ${normalizedCurrency}, ${normalizedCountry}, 0, 0)
  `);
  const [wallet] = await db.select().from(walletsTable)
    .where(and(
      eq(walletsTable.userId, userId),
      eq(walletsTable.currency, normalizedCurrency),
      eq(walletsTable.country, normalizedCountry),
    ))
    .limit(1);
  if (!wallet) throw new Error("Unable to create country wallet");
  return wallet;
}