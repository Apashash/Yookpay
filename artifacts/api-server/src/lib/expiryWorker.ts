import { db } from "@workspace/db";
import { transactionsTable } from "@workspace/db/schema";
import { and, eq, lt, or, isNull, ne } from "drizzle-orm";
import { logger } from "./logger";
import { dispatchWebhook, buildTxPayload, getNotificationUrl } from "./webhookDispatch";
import { getDepositStatus, getPayoutStatus, pawaFinalStatus, pawaResultStatus } from "./pawapay";
import { settleProviderTransaction } from "./walletSettlement";

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
        const metadata = (tx.metadata as Record<string, unknown> | null) ?? {};
        const isPawaPay = String(metadata.provider ?? "").toUpperCase() === "PAWAPAY";

        // pawaPay may legitimately remain ACCEPTED for longer than our local
        // timeout. Never fail/refund it without an authoritative provider
        // final state, otherwise a late payout could complete after a refund.
        if (isPawaPay) {
          if (!tx.providerReference) {
            logger.warn({ txId: tx.id }, "Expiry worker: pawaPay transaction has no provider reference; keeping pending");
            continue;
          }
          try {
            const providerResult = pawaResultStatus(
              tx.type === "WITHDRAWAL"
                ? await getPayoutStatus(tx.providerReference)
                : await getDepositStatus(tx.providerReference),
            );
            const verifiedStatus = pawaFinalStatus(providerResult.status);
            if (!verifiedStatus) {
              logger.info(
                { txId: tx.id, providerStatus: providerResult.status },
                "Expiry worker: pawaPay transaction is still non-final",
              );
              continue;
            }
            const settled = await settleProviderTransaction(tx.id, verifiedStatus);
            if (settled) {
              dispatchWebhook(
                tx.userId,
                buildTxPayload({ ...tx, status: verifiedStatus, updatedAt: new Date() }),
                getNotificationUrl(tx.metadata),
              );
            }
          } catch (providerErr) {
            logger.warn(
              { providerErr, txId: tx.id },
              "Expiry worker: pawaPay verification unavailable; keeping transaction pending",
            );
          }
          continue;
        }

        const expiredAt = new Date();
        await db.update(transactionsTable).set({
          metadata: {
            ...metadata,
            expiredAt: expiredAt.toISOString(),
            expireReason: `Aucune confirmation après ${EXPIRY_MINUTES} minutes`,
          },
          updatedAt: expiredAt,
        }).where(and(eq(transactionsTable.id, tx.id), eq(transactionsTable.status, "PENDING")));
        const settled = await settleProviderTransaction(tx.id, "FAILED");
        if (settled) {
          dispatchWebhook(tx.userId, buildTxPayload({ ...tx, status: "FAILED", updatedAt: expiredAt }), getNotificationUrl(tx.metadata));
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
