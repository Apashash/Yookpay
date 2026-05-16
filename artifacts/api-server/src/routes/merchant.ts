import { Router } from "express";
import { db } from "@workspace/db";
import { apiKeysTable, userFeesTable, transactionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";
import { z } from "zod";
import { logger } from "../lib/logger";
import {
  calculateFeeWithRate,
  generateReference,
  CURRENCY_MAP,
  type Country,
  type Operator,
  type TransactionType,
} from "../services/feeService";
import { callPixPayAirtime } from "../lib/pixpay";

const router = Router();

async function resolveMerchantFromKey(rawKey: string): Promise<{ userId: number; keyId: number } | null> {
  const hash = createHash("sha256").update(rawKey).digest("hex");
  const [key] = await db
    .select({ id: apiKeysTable.id, userId: apiKeysTable.userId, keyType: apiKeysTable.keyType, active: apiKeysTable.active })
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.keyHash, hash), eq(apiKeysTable.active, true)))
    .limit(1);
  if (!key || key.keyType !== "payin") return null;
  await db.update(apiKeysTable).set({ lastUsedAt: new Date() }).where(eq(apiKeysTable.id, key.id));
  return { userId: key.userId, keyId: key.id };
}

const payinSchema = z.object({
  country: z.string().length(2).toUpperCase(),
  operator: z.string().min(2).max(20).toUpperCase(),
  phone: z.string().min(6).max(20),
  amount: z.number().int().positive(),
  metadata: z.record(z.unknown()).optional(),
});

// POST /api/merchant/v1/payin
router.post("/v1/payin", async (req, res) => {
  const rawKey = (req.headers["x-api-key"] as string | undefined)?.trim();
  if (!rawKey) {
    res.status(401).json({ error: "Unauthorized", message: "En-tête x-api-key manquant." });
    return;
  }

  const merchant = await resolveMerchantFromKey(rawKey).catch(() => null);
  if (!merchant) {
    res.status(401).json({ error: "Unauthorized", message: "Clé API invalide, révoquée ou de type incorrect." });
    return;
  }

  const parse = payinSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: parse.error.errors[0]?.message });
    return;
  }

  const { country, operator, phone, amount, metadata } = parse.data;
  const currency = CURRENCY_MAP[country as Country];
  if (!currency) {
    res.status(400).json({ error: "ValidationError", message: `Pays non supporté : ${country}` });
    return;
  }

  try {
    // Resolve merchant-specific fee override
    const [userFee] = await db
      .select()
      .from(userFeesTable)
      .where(
        and(
          eq(userFeesTable.userId, merchant.userId),
          eq(userFeesTable.country, country),
          eq(userFeesTable.operator, operator),
          eq(userFeesTable.type, "DEPOSIT" as TransactionType),
        )
      )
      .limit(1);

    const overrideRate = userFee?.rate != null ? Number(userFee.rate) : undefined;
    const fee = calculateFeeWithRate(amount, country as Country, operator as Operator, "DEPOSIT", overrideRate);
    const reference = generateReference();

    // Call PixPay
    const pixResult = await callPixPayAirtime({ currency, serviceId: 1, amount, phone, customData: reference });

    // Record transaction
    const [tx] = await db.insert(transactionsTable).values({
      userId: merchant.userId,
      type: "DEPOSIT",
      amount: String(amount),
      fee: String(fee.feeAmount),
      netAmount: String(fee.netAmount),
      feeRate: String(fee.feeRate),
      currency,
      country,
      operator,
      phone,
      reference,
      providerReference: String(pixResult.transactionId ?? ""),
      status: "PENDING",
      metadata: metadata ?? null,
    }).returning();

    logger.info({ merchantUserId: merchant.userId, ref: reference, amount }, "Merchant payin initiated");

    res.status(201).json({
      success: true,
      reference,
      providerReference: pixResult.transactionId,
      status: "PENDING",
      amount,
      netAmount: fee.netAmount,
      feeAmount: fee.feeAmount,
      feeRate: fee.feeRate,
      currency,
      transactionId: tx!.id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur interne";
    logger.error({ err, merchantUserId: merchant.userId }, "Merchant payin error");
    res.status(500).json({ error: "PayinFailed", message });
  }
});

export default router;
