import crypto from "crypto";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export interface WebhookTxData {
  reference:   string;
  status:      string;
  type:        string;
  amount:      string;
  netAmount:   string;
  fee:         string;
  currency:    string;
  country:     string | null;
  operator:    string | null;
  phone:       string | null;
  createdAt:   string;
  updatedAt:   string;
}

export interface WebhookPayload {
  event:   string;
  sentAt:  string;
  data:    WebhookTxData;
}

/**
 * Fire-and-forget: look up the user's webhookUrl and POST the payload.
 * Never throws — failures are logged and silently swallowed so they
 * never block or break the caller (IPN handlers, expiry worker, etc.).
 */
export function dispatchWebhook(userId: number, payload: WebhookPayload): void {
  void (async () => {
    try {
      const [user] = await db
        .select({ webhookUrl: usersTable.webhookUrl })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

      if (!user?.webhookUrl) return;

      const body    = JSON.stringify(payload);
      const secret  = process.env.SESSION_SECRET ?? "yookpay-secret-key";
      const sig     = crypto.createHmac("sha256", secret).update(body).digest("hex");

      const resp = await fetch(user.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type":        "application/json",
          "X-YookPay-Event":     payload.event,
          "X-YookPay-Signature": `sha256=${sig}`,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      logger.info(
        { userId, url: user.webhookUrl, httpStatus: resp.status, event: payload.event },
        "Webhook dispatched",
      );
    } catch (err) {
      logger.warn({ err, userId }, "Webhook dispatch failed (non-fatal)");
    }
  })();
}

/** Build a webhook payload from a raw transaction row. */
export function buildTxPayload(tx: {
  reference: string;
  status: string;
  type: string;
  amount: string;
  netAmount: string;
  fee: string;
  currency: string;
  country?: string | null;
  operator?: string | null;
  phone?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): WebhookPayload {
  return {
    event:  "transaction.status_update",
    sentAt: new Date().toISOString(),
    data: {
      reference:  tx.reference,
      status:     tx.status,
      type:       tx.type,
      amount:     tx.amount,
      netAmount:  tx.netAmount,
      fee:        tx.fee,
      currency:   tx.currency,
      country:    tx.country ?? null,
      operator:   tx.operator ?? null,
      phone:      tx.phone ?? null,
      createdAt:  tx.createdAt.toISOString(),
      updatedAt:  tx.updatedAt.toISOString(),
    },
  };
}
