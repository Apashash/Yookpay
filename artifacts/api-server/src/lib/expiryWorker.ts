import { db } from "@workspace/db";
import { transactionsTable, walletsTable } from "@workspace/db/schema";
import { and, eq, lt, or, isNull, ne, sql } from "drizzle-orm";
import { logger } from "./logger";

const EXPIRY_MINUTES = 8;
const WORKER_INTERVAL_MS = 30_000; // check every 30 seconds

async function expireStaleTransactions(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - EXPIRY_MINUTES * 60 * 1000);

    // Exclude exchange transactions (operator = 'EXCHANGE') — those stay PENDING
    // until admin explicitly approves or rejects them via the exchange management flow.
    // Use OR to also allow NULL operators (regular non-exchange transactions).
    const stale = await db
      .select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.status, "PENDING"),
          lt(transactionsTable.createdAt, cutoff),
          or(
            isNull(transactionsTable.operator),
            ne(transactionsTable.operator, "EXCHANGE"),
          ),
        ),
      );

    if (stale.length === 0) return;

    logger.info({ count: stale.length }, "Expiry worker: found stale PENDING transactions");

    for (const tx of stale) {
      try {
        await db
          .update(transactionsTable)
          .set({
            status: "FAILED",
            metadata: {
              ...(tx.metadata as object ?? {}),
              expiredAt: new Date().toISOString(),
              expireReason: `Aucune confirmation après ${EXPIRY_MINUTES} minutes`,
            },
            updatedAt: new Date(),
          })
          .where(and(eq(transactionsTable.id, tx.id), eq(transactionsTable.status, "PENDING")));

        // Refund wallet for WITHDRAWAL that timed out
        if (tx.type === "WITHDRAWAL") {
          const [wallet] = await db
            .select()
            .from(walletsTable)
            .where(and(eq(walletsTable.userId, tx.userId), eq(walletsTable.currency, tx.currency)))
            .limit(1);

          if (wallet) {
            const refund = parseFloat(tx.netAmount) + parseFloat(tx.fee);
            await db
              .update(walletsTable)
              .set({
                balance: sql`${walletsTable.balance} + ${refund.toFixed(2)}::numeric`,
                updatedAt: new Date(),
              })
              .where(eq(walletsTable.id, wallet.id));

            logger.info(
              { txId: tx.id, reference: tx.reference, refund, currency: tx.currency },
              "Expiry worker: WITHDRAWAL expired — wallet refunded",
            );
          }
        } else {
          logger.info(
            { txId: tx.id, reference: tx.reference, type: tx.type },
            "Expiry worker: transaction expired",
          );
        }
      } catch (txErr) {
        logger.error({ txErr, txId: tx.id }, "Expiry worker: error expiring single transaction");
      }
    }
  } catch (err) {
    logger.error({ err }, "Expiry worker: error during stale transaction sweep");
  }
}

export function startExpiryWorker(): void {
  logger.info(
    { expiryMinutes: EXPIRY_MINUTES, intervalMs: WORKER_INTERVAL_MS },
    "Transaction expiry worker started",
  );
  // Run once immediately on startup (catches any leftover stale transactions)
  void expireStaleTransactions();
  // Then run on interval
  setInterval(() => void expireStaleTransactions(), WORKER_INTERVAL_MS);
}
