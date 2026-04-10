import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, walletsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { Request, Response } from "express";
import { createNotification } from "../lib/notify";

const router = Router();

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
  // PixPay confirmed states: "SUCCESSFUL" (main), "SUCCESS", "SUCCESSFULL" (legacy typo), "COMPLETED"
  const isSuccess = state === "SUCCESSFUL" || state === "SUCCESS" || state === "SUCCESSFULL" || state === "COMPLETED";
  // PixPay failure states
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
        updatedAt: new Date(),
      })
      .where(eq(transactionsTable.id, tx.id));

    if (isSuccess) {
      if (tx.type === "DEPOSIT") {
        const [wallet] = await db
          .select()
          .from(walletsTable)
          .where(and(eq(walletsTable.userId, tx.userId), eq(walletsTable.currency, tx.currency)))
          .limit(1);

        if (wallet) {
          const creditAmount = parseFloat(tx.netAmount);
          const newBalance = parseFloat(wallet.balance) + creditAmount;
          await db
            .update(walletsTable)
            .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
            .where(eq(walletsTable.id, wallet.id));

          req.log?.info({ txId: tx.id, reference, creditAmount, currency: tx.currency }, "IPN DEPOSIT SUCCESS - wallet credited");
        }
        const meta = tx.metadata as Record<string, any> | null;
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
        req.log?.info({ txId: tx.id, reference }, "IPN WITHDRAWAL SUCCESS - balance already reserved");
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
          const newBalance = parseFloat(wallet.balance) + refundAmount;
          await db
            .update(walletsTable)
            .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
            .where(eq(walletsTable.id, wallet.id));

          req.log?.info({ txId: tx.id, reference, refundAmount, currency: tx.currency }, "IPN WITHDRAWAL FAILED - wallet refunded");
        }
        await createNotification(
          tx.userId,
          "WITHDRAWAL",
          "Retrait échoué",
          `Votre retrait de ${parseFloat(tx.amount).toLocaleString("fr-FR")} ${tx.currency} a échoué. Votre solde a été remboursé.`,
          tx.id,
        );
      } else if (tx.type === "DEPOSIT") {
        await createNotification(
          tx.userId,
          "DEPOSIT",
          "Dépôt échoué",
          `Votre dépôt de ${parseFloat(tx.amount).toLocaleString("fr-FR")} ${tx.currency} n'a pas pu être traité.`,
          tx.id,
        );
      }
    }

    res.status(200).json({ ok: true, processed: newStatus });
  } catch (err) {
    req.log?.error({ err, reference }, "PixPay IPN processing error");
    res.status(500).json({ ok: false, error: "processing_error" });
  }
});

export default router;
