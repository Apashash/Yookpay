import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, walletsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { Request, Response } from "express";
import { createNotification } from "../lib/notify";
import { dispatchWebhook, buildTxPayload, getNotificationUrl } from "../lib/webhookDispatch";
import { isMavianceSuccess, isMavianceFailed } from "../lib/maviance";

const router = Router();

// ─── PixPay IPN ───────────────────────────────────────────────────────────────

interface PixPayIpnBody {
  transaction_id?: string;
  amount?: number;
  state?: string;
  error?: string;
  response?: string;
  custom_data?: string;
  hash?: string;
  sms_link?: string;
}

router.post("/pixpay", async (req: Request, res: Response) => {
  const body = req.body as PixPayIpnBody;

  req.log?.info({ pixId: body.transaction_id, state: body.state, ref: body.custom_data }, "PixPay IPN received");

  const reference = body.custom_data;
  if (!reference) {
    res.status(200).json({ ok: false, reason: "no_reference" });
    return;
  }

  const state = (body.state ?? "").toUpperCase().trim();
  const isSuccess = state === "SUCCESSFUL" || state === "SUCCESS" || state === "SUCCESSFULL" || state === "COMPLETED";
  const isFailed  = state === "FAILED" || state === "REJECTED" || state === "CANCELLED" || state === "ERROR";

  if (!isSuccess && !isFailed) {
    res.status(200).json({ ok: true, note: "intermediate_state_ignored" });
    return;
  }

  try {
    const [tx] = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.reference, reference))
      .limit(1);

    if (!tx) {
      req.log?.warn({ reference }, "PixPay IPN: transaction not found");
      res.status(200).json({ ok: false, reason: "not_found" });
      return;
    }

    if (tx.status !== "PENDING") {
      res.status(200).json({ ok: true, note: "already_processed" });
      return;
    }

    const newStatus = isSuccess ? "SUCCESS" : "FAILED";
    const updatedAt = new Date();

    await db
      .update(transactionsTable)
      .set({
        status: newStatus,
        providerReference: body.transaction_id ?? tx.providerReference,
        metadata: {
          ...(tx.metadata as object ?? {}),
          pixState: body.state,
          pixResponse: body.response,
          pixError: body.error,
          ipnReceivedAt: new Date().toISOString(),
        },
        updatedAt,
      })
      .where(eq(transactionsTable.id, tx.id));

    dispatchWebhook(tx.userId, buildTxPayload({ ...tx, status: newStatus, updatedAt }), getNotificationUrl(tx.metadata));

    await handleWalletAndNotify(tx, newStatus, isSuccess, isFailed, req.log);

    res.status(200).json({ ok: true, processed: newStatus });
  } catch (err) {
    req.log?.error({ err, reference }, "PixPay IPN processing error");
    res.status(500).json({ ok: false, error: "processing_error" });
  }
});

// ─── Maviance IPN ─────────────────────────────────────────────────────────────

interface MavianceIpnBody {
  payToken?:   string;
  trid?:       string;         // our reference (YKP-XXXXX)
  status?:     string;
  amount?:     number;
  fees?:       number;
  currency?:   string;
  errorCode?:  string;
  message?:    string;
}

router.post("/maviance", async (req: Request, res: Response) => {
  const body = req.body as MavianceIpnBody;

  req.log?.info(
    { payToken: body.payToken, trid: body.trid, status: body.status },
    "Maviance IPN received"
  );

  // trid is our internal reference set during quote/collect
  const reference = body.trid;
  if (!reference) {
    res.status(200).json({ ok: false, reason: "no_reference" });
    return;
  }

  const rawStatus = (body.status ?? "").trim();
  const isSuccess = isMavianceSuccess(rawStatus);
  const isFailed  = isMavianceFailed(rawStatus);

  if (!isSuccess && !isFailed) {
    req.log?.info({ reference, status: rawStatus }, "Maviance IPN: intermediate state ignored");
    res.status(200).json({ ok: true, note: "intermediate_state_ignored" });
    return;
  }

  try {
    const [tx] = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.reference, reference))
      .limit(1);

    if (!tx) {
      req.log?.warn({ reference }, "Maviance IPN: transaction not found");
      res.status(200).json({ ok: false, reason: "not_found" });
      return;
    }

    if (tx.status !== "PENDING") {
      res.status(200).json({ ok: true, note: "already_processed" });
      return;
    }

    const newStatus = isSuccess ? "SUCCESS" : "FAILED";
    const updatedAt = new Date();

    await db
      .update(transactionsTable)
      .set({
        status: newStatus,
        providerReference: body.payToken ?? tx.providerReference,
        metadata: {
          ...(tx.metadata as object ?? {}),
          mavianceStatus:    rawStatus,
          mavianceErrorCode: body.errorCode,
          mavianceMessage:   body.message,
          ipnReceivedAt:     new Date().toISOString(),
        },
        updatedAt,
      })
      .where(eq(transactionsTable.id, tx.id));

    dispatchWebhook(tx.userId, buildTxPayload({ ...tx, status: newStatus, updatedAt }), getNotificationUrl(tx.metadata));

    await handleWalletAndNotify(tx, newStatus, isSuccess, isFailed, req.log);

    res.status(200).json({ ok: true, processed: newStatus });
  } catch (err) {
    req.log?.error({ err, reference }, "Maviance IPN processing error");
    res.status(500).json({ ok: false, error: "processing_error" });
  }
});

// ─── E-nkap (card) IPN ───────────────────────────────────────────────────────

interface EnkapIpnBody {
  payToken?:     string;
  orderRef?:     string;  // our reference (may be passed in redirectUrl query params instead)
  trid?:         string;
  status?:       string;
  amount?:       number;
  currency?:     string;
  errorCode?:    string;
  message?:      string;
}

router.post("/enkap", async (req: Request, res: Response) => {
  const body = req.body as EnkapIpnBody;
  // E-nkap may send reference in trid or orderRef
  const reference = body.trid ?? body.orderRef;

  req.log?.info(
    { payToken: body.payToken, reference, status: body.status },
    "E-nkap card IPN received"
  );

  if (!reference) {
    res.status(200).json({ ok: false, reason: "no_reference" });
    return;
  }

  const rawStatus = (body.status ?? "").trim();
  const isSuccess = isMavianceSuccess(rawStatus);
  const isFailed  = isMavianceFailed(rawStatus);

  if (!isSuccess && !isFailed) {
    res.status(200).json({ ok: true, note: "intermediate_state_ignored" });
    return;
  }

  try {
    const [tx] = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.reference, reference))
      .limit(1);

    if (!tx) {
      req.log?.warn({ reference }, "E-nkap IPN: transaction not found");
      res.status(200).json({ ok: false, reason: "not_found" });
      return;
    }

    if (tx.status !== "PENDING") {
      res.status(200).json({ ok: true, note: "already_processed" });
      return;
    }

    const newStatus = isSuccess ? "SUCCESS" : "FAILED";
    const updatedAt = new Date();

    await db
      .update(transactionsTable)
      .set({
        status: newStatus,
        providerReference: body.payToken ?? tx.providerReference,
        metadata: {
          ...(tx.metadata as object ?? {}),
          enkapStatus:    rawStatus,
          enkapErrorCode: body.errorCode,
          enkapMessage:   body.message,
          ipnReceivedAt:  new Date().toISOString(),
        },
        updatedAt,
      })
      .where(eq(transactionsTable.id, tx.id));

    dispatchWebhook(tx.userId, buildTxPayload({ ...tx, status: newStatus, updatedAt }), getNotificationUrl(tx.metadata));

    // Card deposits only; credit wallet on success
    await handleWalletAndNotify(tx, newStatus, isSuccess, isFailed, req.log);

    res.status(200).json({ ok: true, processed: newStatus });
  } catch (err) {
    req.log?.error({ err, reference }, "E-nkap IPN processing error");
    res.status(500).json({ ok: false, error: "processing_error" });
  }
});

// ─── Shared wallet/notification logic ────────────────────────────────────────

async function handleWalletAndNotify(
  tx: typeof transactionsTable.$inferSelect,
  newStatus: string,
  isSuccess: boolean,
  isFailed: boolean,
  log: any,
): Promise<void> {
  const meta = tx.metadata as Record<string, any> | null;

  if (isSuccess) {
    if (tx.type === "DEPOSIT" || tx.type === "CARD_DEPOSIT") {
      const [wallet] = await db
        .select()
        .from(walletsTable)
        .where(and(eq(walletsTable.userId, tx.userId), eq(walletsTable.currency, tx.currency)))
        .limit(1);

      if (wallet) {
        const creditAmount = parseFloat(tx.netAmount);
        const newBalance   = parseFloat(wallet.balance) + creditAmount;
        await db
          .update(walletsTable)
          .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
          .where(eq(walletsTable.id, wallet.id));
        log?.info({ txId: tx.id, creditAmount, currency: tx.currency }, "IPN DEPOSIT SUCCESS - wallet credited");
      }

      const isYookLink = !!meta?.paymentLinkId;
      const linkTitle  = meta?.paymentLinkTitle as string | undefined;
      await createNotification(
        tx.userId,
        isYookLink ? "PAYMENT_LINK" : "DEPOSIT",
        isYookLink ? "Paiement YookLink reçu ✓" : "Dépôt confirmé ✓",
        isYookLink
          ? `Vous avez reçu ${parseFloat(tx.netAmount).toLocaleString("fr-FR")} ${tx.currency} via le lien${linkTitle ? ` "${linkTitle}"` : ""}.`
          : `Votre dépôt de ${parseFloat(tx.netAmount).toLocaleString("fr-FR")} ${tx.currency} a bien été reçu.`,
        tx.id,
      );
    } else if (tx.type === "WITHDRAWAL") {
      log?.info({ txId: tx.id }, "IPN WITHDRAWAL SUCCESS - balance already reserved");
      await createNotification(
        tx.userId,
        "WITHDRAWAL",
        "Retrait confirmé ✓",
        `Votre retrait de ${parseFloat(tx.amount).toLocaleString("fr-FR")} ${tx.currency} a été effectué avec succès.`,
        tx.id,
      );
    }
  } else if (isFailed) {
    if (tx.type === "WITHDRAWAL") {
      const [wallet] = await db
        .select()
        .from(walletsTable)
        .where(and(eq(walletsTable.userId, tx.userId), eq(walletsTable.currency, tx.currency)))
        .limit(1);

      if (wallet) {
        const refundAmount = parseFloat(tx.netAmount) + parseFloat(tx.fee);
        const newBalance   = parseFloat(wallet.balance) + refundAmount;
        await db
          .update(walletsTable)
          .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
          .where(eq(walletsTable.id, wallet.id));
        log?.info({ txId: tx.id, refundAmount, currency: tx.currency }, "IPN WITHDRAWAL FAILED - wallet refunded");
      }

      await createNotification(
        tx.userId,
        "WITHDRAWAL",
        "Retrait échoué",
        `Votre retrait de ${parseFloat(tx.amount).toLocaleString("fr-FR")} ${tx.currency} a échoué. Votre solde a été remboursé.`,
        tx.id,
      );
    } else if (tx.type === "DEPOSIT" || tx.type === "CARD_DEPOSIT") {
      await createNotification(
        tx.userId,
        "DEPOSIT",
        "Dépôt échoué",
        `Votre dépôt de ${parseFloat(tx.amount).toLocaleString("fr-FR")} ${tx.currency} n'a pas pu être traité.`,
        tx.id,
      );
    }
  }
}

export default router;
