import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, walletsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyNpIpnSignature } from "../lib/nowpayments";
import pino from "pino";
import { dispatchWebhook, buildTxPayload } from "../lib/webhookDispatch";

const router = Router();
const logger = pino({ level: "info" });

// POST /nowpayments/ipn
// Called by NowPayments when a payment status changes
router.post("/ipn", async (req, res) => {
  const sig = req.headers["x-nowpayments-sig"] as string | undefined;
  const body = req.body as Record<string, unknown>;

  if (sig && !verifyNpIpnSignature(body, sig)) {
    logger.warn({ sig }, "NowPayments IPN: invalid signature");
    res.status(403).json({ error: "InvalidSignature" });
    return;
  }

  const paymentId = String(body.payment_id ?? "");
  const status = String(body.payment_status ?? "");
  const orderId = String(body.order_id ?? "");
  const actuallyPaid = parseFloat(String(body.actually_paid ?? "0"));

  logger.info({ paymentId, status, orderId, actuallyPaid }, "NowPayments IPN received");

  try {
    // Find transaction by reference (order_id) or providerReference (payment_id)
    const [tx] = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.reference, orderId))
      .limit(1);

    if (!tx) {
      logger.warn({ orderId }, "NowPayments IPN: transaction not found");
      res.json({ success: true });
      return;
    }

    if (tx.status !== "PENDING") {
      res.json({ success: true, message: "Already processed" });
      return;
    }

    const isSuccess = ["finished", "confirmed", "partially_paid"].includes(status);
    const isFailed = ["failed", "expired", "refunded"].includes(status);

    if (isSuccess) {
      // Credit USDT wallet
      const [wallet] = await db
        .select()
        .from(walletsTable)
        .where(and(eq(walletsTable.userId, tx.userId), eq(walletsTable.currency, "USDT")))
        .limit(1);

      if (wallet) {
        await db
          .update(walletsTable)
          .set({
            balance: (parseFloat(wallet.balance) + parseFloat(tx.netAmount)).toFixed(8),
            updatedAt: new Date(),
          })
          .where(eq(walletsTable.id, wallet.id));
      }

      const successUpdatedAt = new Date();
      await db
        .update(transactionsTable)
        .set({
          status: "SUCCESS",
          providerReference: paymentId,
          metadata: { ...(tx.metadata as object), nowpaymentsStatus: status, actuallyPaid, completedAt: successUpdatedAt.toISOString() },
          updatedAt: successUpdatedAt,
        })
        .where(eq(transactionsTable.id, tx.id));

      dispatchWebhook(tx.userId, buildTxPayload({ ...tx, status: "SUCCESS", updatedAt: successUpdatedAt }));
      logger.info({ txId: tx.id, paymentId, actuallyPaid }, "NowPayments IPN: USDT credited");
    } else if (isFailed) {
      const failedUpdatedAt = new Date();
      await db
        .update(transactionsTable)
        .set({
          status: "FAILED",
          providerReference: paymentId,
          metadata: { ...(tx.metadata as object), nowpaymentsStatus: status, failedAt: failedUpdatedAt.toISOString() },
          updatedAt: failedUpdatedAt,
        })
        .where(eq(transactionsTable.id, tx.id));

      dispatchWebhook(tx.userId, buildTxPayload({ ...tx, status: "FAILED", updatedAt: failedUpdatedAt }));
      logger.info({ txId: tx.id, paymentId }, "NowPayments IPN: payment failed");
    } else {
      // Update status in metadata only
      await db
        .update(transactionsTable)
        .set({
          providerReference: paymentId,
          metadata: { ...(tx.metadata as object), nowpaymentsStatus: status },
          updatedAt: new Date(),
        })
        .where(eq(transactionsTable.id, tx.id));
    }

    res.json({ success: true });
  } catch (err) {
    logger.error({ err, paymentId, orderId }, "NowPayments IPN error");
    res.status(500).json({ error: "InternalError" });
  }
});

export default router;
