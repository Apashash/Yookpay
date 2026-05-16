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
 * Fire-and-forget webhook dispatch.
 *
 * Priority:
 *  1. `notificationUrl` — per-transaction URL supplied in the original API
 *     request and stored in metadata (merchant API flow).
 *  2. User's saved `webhookUrl` — fallback for dashboard/payment-link flows.
 *
 * Never throws — failures are logged and silently swallowed so they never
 * block or break the caller (IPN handlers, expiry worker, etc.).
 */
export function dispatchWebhook(
  userId: number,
  payload: WebhookPayload,
  notificationUrl?: string | null,
): void {
  void (async () => {
    try {
      let url = notificationUrl ?? null;

      // Fall back to the user's stored webhook URL if no per-transaction URL
      if (!url) {
        const [user] = await db
          .select({ webhookUrl: usersTable.webhookUrl })
          .from(usersTable)
          .where(eq(usersTable.id, userId))
          .limit(1);
        url = user?.webhookUrl ?? null;
      }

      if (!url) return;

      const body   = JSON.stringify(payload);
      const secret = process.env.SESSION_SECRET ?? "yookpay-secret-key";
      const sig    = crypto.createHmac("sha256", secret).update(body).digest("hex");

      const resp = await fetch(url, {
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
        { userId, url, httpStatus: resp.status, event: payload.event },
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

/** Extract the notificationUrl stored in a transaction's metadata (if any). */
export function getNotificationUrl(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const url = (metadata as Record<string, unknown>).notificationUrl;
  return typeof url === "string" && url ? url : null;
}
