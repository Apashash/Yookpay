import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, walletsTable, userFeesTable } from "@workspace/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/authMiddleware";
import { transactionRateLimit } from "../middlewares/rateLimitMiddleware";
import {
  calculateFee,
  calculateFeeWithRate,
  generateReference,
  CURRENCY_MAP,
  type Country,
  type Operator,
  type TransactionType,
} from "../services/feeService";
import { initiatePayment } from "../services/providerService";
import { z } from "zod";

const GLOBAL_COUNTRY = "ZZ";
const GLOBAL_OPERATOR = "GLOBAL";

// Look up the effective fee rate for a user (specific > global > undefined=default)
async function getUserFeeRate(
  userId: number,
  country: string,
  operator: string,
  type: TransactionType,
): Promise<number | undefined> {
  const overrides = await db
    .select()
    .from(userFeesTable)
    .where(eq(userFeesTable.userId, userId));

  let specific: number | undefined;
  let global: number | undefined;

  for (const o of overrides) {
    if (o.transactionType !== type) continue;
    if (o.country === country && o.operator === operator) {
      specific = parseFloat(o.rate);
    } else if (o.country === GLOBAL_COUNTRY && o.operator === GLOBAL_OPERATOR) {
      global = parseFloat(o.rate);
    }
  }

  return specific ?? global;
}

const router = Router();

function formatTx(t: {
  id: number;
  userId: number;
  type: string;
  status: string;
  amount: string;
  fee: string;
  netAmount: string;
  currency: string;
  country: string | null;
  operator: string | null;
  phone: string | null;
  reference: string;
  feeRate: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: t.id,
    userId: t.userId,
    type: t.type,
    status: t.status,
    amount: parseFloat(t.amount),
    fee: parseFloat(t.fee),
    netAmount: parseFloat(t.netAmount),
    currency: t.currency,
    country: t.country ?? null,
    operator: t.operator ?? null,
    phone: t.phone ?? null,
    reference: t.reference,
    feeRate: t.feeRate ? parseFloat(t.feeRate) : null,
    metadata: t.metadata ?? null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

// GET /transactions
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  const page = parseInt(String(req.query.page ?? "1"));
  const limit = Math.min(parseInt(String(req.query.limit ?? "20")), 100);
  const offset = (page - 1) * limit;
  const statusFilter = req.query.status as string | undefined;
  const currencyFilter = req.query.currency as string | undefined;

  try {
    const conditions = [eq(transactionsTable.userId, req.userId!)];
    if (statusFilter) conditions.push(eq(transactionsTable.status, statusFilter));
    if (currencyFilter) conditions.push(eq(transactionsTable.currency, currencyFilter));

    const where = and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(transactionsTable)
        .where(where)
        .orderBy(desc(transactionsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(transactionsTable).where(where),
    ]);

    res.json({
      transactions: rows.map(formatTx),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    req.log.error({ err }, "Get transactions error");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch transactions" });
  }
});

// POST /transactions/fee-preview
router.post("/fee-preview", authMiddleware, async (req: AuthRequest, res) => {
  const schema = z.object({
    amount: z.number().positive(),
    country: z.string().min(2),
    operator: z.string().min(2),
    type: z.enum(["DEPOSIT", "WITHDRAWAL", "TRANSFER"]),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: "Invalid fee preview parameters" });
    return;
  }

  const { amount, country, operator, type } = parse.data;
  try {
    const userRate = await getUserFeeRate(req.userId!, country, operator, type as TransactionType);
    const breakdown = userRate !== undefined
      ? calculateFeeWithRate(amount, country as Country, operator as Operator, type as TransactionType, userRate)
      : calculateFee(amount, country as Country, operator as Operator, type as TransactionType);
    res.json(breakdown);
  } catch (err) {
    req.log.error({ err }, "Fee preview error");
    res.status(400).json({ error: "BadRequest", message: "Cannot calculate fee for this combination" });
  }
});

// POST /transactions/deposit
router.post("/deposit", authMiddleware, transactionRateLimit, async (req: AuthRequest, res) => {
  const schema = z.object({
    amount: z.number().min(100),
    country: z.string().min(2),
    operator: z.string().min(2),
    phone: z.string().min(6),
    feeBearer: z.enum(["SENDER", "RECIPIENT"]).default("SENDER"),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: "Invalid deposit parameters" });
    return;
  }

  const { amount, country, operator, phone, feeBearer } = parse.data;
  const currency = CURRENCY_MAP[country as Country];
  const reference = generateReference();

  try {
    const userRate = await getUserFeeRate(req.userId!, country, operator, "DEPOSIT");
    const feeBreakdown = userRate !== undefined
      ? calculateFeeWithRate(amount, country as Country, operator as Operator, "DEPOSIT", userRate)
      : calculateFee(amount, country as Country, operator as Operator, "DEPOSIT");

    const [tx] = await db
      .insert(transactionsTable)
      .values({
        userId: req.userId!,
        type: "DEPOSIT",
        status: "PENDING",
        amount: amount.toString(),
        fee: feeBreakdown.feeAmount.toString(),
        netAmount: feeBreakdown.netAmount.toString(),
        currency,
        country,
        operator,
        phone,
        reference,
        feeRate: feeBreakdown.feeRate.toString(),
        metadata: { initiatedAt: new Date().toISOString() },
      })
      .returning();

    req.log.info(
      { txId: tx.id, reference, userId: req.userId, amount, currency, operator, country },
      "Deposit transaction created"
    );

    const providerResult = await initiatePayment({
      phone,
      amount,
      currency,
      operator,
      country,
      reference,
      type: "DEPOSIT",
    });

    const newStatus = providerResult.status === "SUCCESS" ? "SUCCESS" : "FAILED";

    const [updatedTx] = await db
      .update(transactionsTable)
      .set({
        status: newStatus,
        providerReference: providerResult.providerReference,
        metadata: {
          initiatedAt: new Date().toISOString(),
          providerResponse: providerResult.message,
        },
        updatedAt: new Date(),
      })
      .where(eq(transactionsTable.id, tx.id))
      .returning();

    if (newStatus === "SUCCESS") {
      const [wallet] = await db
        .select()
        .from(walletsTable)
        .where(and(eq(walletsTable.userId, req.userId!), eq(walletsTable.currency, currency)))
        .limit(1);

      if (wallet) {
        // SENDER pays: wallet receives netAmount (grossAmount - fee)
        // RECIPIENT pays: wallet receives grossAmount (full), fee is borne by wallet owner
        const creditAmount = feeBearer === "RECIPIENT"
          ? feeBreakdown.grossAmount
          : feeBreakdown.netAmount;
        const newBalance = parseFloat(wallet.balance) + creditAmount;
        await db
          .update(walletsTable)
          .set({ balance: newBalance.toString(), updatedAt: new Date() })
          .where(eq(walletsTable.id, wallet.id));

        req.log.info(
          { txId: tx.id, reference, creditAmount, feeBearer, currency },
          "Deposit SUCCESS - wallet updated"
        );
      }
    } else {
      req.log.warn({ txId: tx.id, reference }, "Deposit FAILED by provider");
    }

    res.status(201).json({
      transaction: formatTx(updatedTx),
      feeBreakdown,
      feeBearer,
      message: providerResult.message,
    });
  } catch (err) {
    req.log.error({ err, reference }, "Deposit error");
    res.status(500).json({ error: "InternalError", message: "Deposit failed" });
  }
});

// POST /transactions/withdraw
router.post("/withdraw", authMiddleware, transactionRateLimit, async (req: AuthRequest, res) => {
  const schema = z.object({
    amount: z.number().min(100),
    currency: z.string().min(3),
    country: z.string().min(2),
    phone: z.string().min(6),
    operator: z.string().min(2),
    feeBearer: z.enum(["SENDER", "RECIPIENT"]).default("SENDER"),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: "Invalid withdrawal parameters" });
    return;
  }

  const { amount, currency, country, phone, operator, feeBearer } = parse.data;
  const reference = generateReference();

  try {
    const [wallet] = await db
      .select()
      .from(walletsTable)
      .where(and(eq(walletsTable.userId, req.userId!), eq(walletsTable.currency, currency)))
      .limit(1);

    const balance = wallet ? parseFloat(wallet.balance) : 0;

    if (!wallet || balance < amount) {
      res.status(400).json({
        error: "InsufficientFunds",
        message: `Solde du portefeuille ${currency} insuffisant (solde actuel : ${balance.toLocaleString("fr-FR")} ${currency})`,
      });
      return;
    }

    let feeBreakdown;
    try {
      const userRate = await getUserFeeRate(req.userId!, country, operator, "WITHDRAWAL");
      feeBreakdown = userRate !== undefined
        ? calculateFeeWithRate(amount, country as Country, operator as Operator, "WITHDRAWAL", userRate)
        : calculateFee(amount, country as Country, operator as Operator, "WITHDRAWAL");
    } catch {
      // Fallback: use a default fee of 2% if no specific config exists
      const fee = Math.round(amount * 0.02);
      feeBreakdown = {
        grossAmount: amount,
        feeRate: 0.02,
        feeAmount: fee,
        netAmount: amount + fee,
        currency,
        operator,
        country,
      };
    }

    // SENDER pays: wallet must cover amount + fee (netAmount)
    // RECIPIENT pays: wallet only needs to cover the gross amount
    const requiredBalance = feeBearer === "RECIPIENT" ? feeBreakdown.grossAmount : feeBreakdown.netAmount;
    if (balance < requiredBalance) {
      res.status(400).json({
        error: "InsufficientFunds",
        message: `Solde du portefeuille ${currency} insuffisant pour couvrir le montant${feeBearer === "SENDER" ? " et les frais" : ""} (nécessaire : ${requiredBalance.toLocaleString("fr-FR")} ${currency}, disponible : ${balance.toLocaleString("fr-FR")} ${currency})`,
      });
      return;
    }

    const [tx] = await db
      .insert(transactionsTable)
      .values({
        userId: req.userId!,
        type: "WITHDRAWAL",
        status: "PENDING",
        amount: amount.toString(),
        fee: feeBreakdown.feeAmount.toString(),
        netAmount: feeBreakdown.netAmount.toString(),
        currency,
        country,
        operator,
        phone,
        reference,
        feeRate: feeBreakdown.feeRate.toString(),
        metadata: { initiatedAt: new Date().toISOString() },
      })
      .returning();

    req.log.info(
      { txId: tx.id, reference, userId: req.userId, amount, currency, operator },
      "Withdrawal transaction created"
    );

    const providerResult = await initiatePayment({
      phone,
      amount,
      currency,
      operator,
      country,
      reference,
      type: "WITHDRAWAL",
    });

    const newStatus = providerResult.status === "SUCCESS" ? "SUCCESS" : "FAILED";

    const [updatedTx] = await db
      .update(transactionsTable)
      .set({
        status: newStatus,
        providerReference: providerResult.providerReference,
        metadata: {
          initiatedAt: new Date().toISOString(),
          providerResponse: providerResult.message,
        },
        updatedAt: new Date(),
      })
      .where(eq(transactionsTable.id, tx.id))
      .returning();

    if (newStatus === "SUCCESS") {
      // SENDER pays: debit amount + fee (netAmount)
      // RECIPIENT pays: debit amount only (grossAmount), recipient absorbs fee
      const debitAmount = requiredBalance;
      const newBalance = parseFloat(wallet.balance) - debitAmount;
      await db
        .update(walletsTable)
        .set({ balance: Math.max(newBalance, 0).toString(), updatedAt: new Date() })
        .where(eq(walletsTable.id, wallet.id));

      req.log.info({ txId: tx.id, reference, debitAmount, feeBearer, currency }, "Withdrawal SUCCESS - wallet deducted");
    } else {
      req.log.warn({ txId: tx.id, reference }, "Withdrawal FAILED by provider");
    }

    res.status(201).json({
      transaction: formatTx(updatedTx),
      feeBreakdown,
      feeBearer,
      message: providerResult.message,
    });
  } catch (err) {
    req.log.error({ err, reference }, "Withdrawal error");
    res.status(500).json({ error: "InternalError", message: "Withdrawal failed" });
  }
});

// POST /transactions/transfer
router.post("/transfer", authMiddleware, transactionRateLimit, async (req: AuthRequest, res) => {
  const schema = z.object({
    amount: z.number().min(100),
    fromCurrency: z.enum(["XAF", "XOF", "CDF"]),
    toCurrency: z.enum(["XAF", "XOF", "CDF"]),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: "Invalid transfer parameters" });
    return;
  }

  const { amount, fromCurrency, toCurrency } = parse.data;
  if (fromCurrency === toCurrency) {
    res.status(400).json({ error: "BadRequest", message: "From and to currency must be different" });
    return;
  }

  const reference = generateReference();
  const countryMap: Record<string, Country> = { XAF: "CM", XOF: "SN", CDF: "CD" };
  const fromCountry = countryMap[fromCurrency] as Country;

  // Transfer fee: user-specific global rate or default 1.9%
  const globalTransferRate = await getUserFeeRate(req.userId!, GLOBAL_COUNTRY, GLOBAL_OPERATOR, "TRANSFER") ?? 0.019;
  const fee = Math.round(amount * globalTransferRate);
  const netAmount = amount - fee;

  try {
    const [fromWallet] = await db
      .select()
      .from(walletsTable)
      .where(and(eq(walletsTable.userId, req.userId!), eq(walletsTable.currency, fromCurrency)))
      .limit(1);

    if (!fromWallet || parseFloat(fromWallet.balance) < amount) {
      res.status(400).json({ error: "InsufficientFunds", message: "Insufficient wallet balance" });
      return;
    }

    const [toWallet] = await db
      .select()
      .from(walletsTable)
      .where(and(eq(walletsTable.userId, req.userId!), eq(walletsTable.currency, toCurrency)))
      .limit(1);

    if (!toWallet) {
      res.status(404).json({ error: "NotFound", message: "Target wallet not found" });
      return;
    }

    const [tx] = await db
      .insert(transactionsTable)
      .values({
        userId: req.userId!,
        type: "TRANSFER",
        status: "PENDING",
        amount: amount.toString(),
        fee: fee.toString(),
        netAmount: netAmount.toString(),
        currency: fromCurrency,
        country: fromCountry,
        reference,
        feeRate: globalTransferRate.toString(),
        metadata: { fromCurrency, toCurrency, initiatedAt: new Date().toISOString() },
      })
      .returning();

    // Deduct from source wallet
    await db
      .update(walletsTable)
      .set({
        balance: (parseFloat(fromWallet.balance) - amount).toString(),
        updatedAt: new Date(),
      })
      .where(eq(walletsTable.id, fromWallet.id));

    // Add to target wallet (using netAmount as converted amount - in real scenario, apply exchange rate)
    await db
      .update(walletsTable)
      .set({
        balance: (parseFloat(toWallet.balance) + netAmount).toString(),
        updatedAt: new Date(),
      })
      .where(eq(walletsTable.id, toWallet.id));

    const [updatedTx] = await db
      .update(transactionsTable)
      .set({ status: "SUCCESS", updatedAt: new Date() })
      .where(eq(transactionsTable.id, tx.id))
      .returning();

    req.log.info(
      { txId: tx.id, reference, userId: req.userId, amount, fromCurrency, toCurrency, fee, netAmount },
      "Transfer SUCCESS"
    );

    res.status(201).json({
      transaction: formatTx(updatedTx),
      feeBreakdown: {
        grossAmount: amount,
        feeRate: globalTransferRate,
        feeAmount: fee,
        netAmount,
        currency: fromCurrency,
        operator: "INTERNAL",
        country: fromCountry,
      },
      message: `Transfer of ${amount} ${fromCurrency} → ${toCurrency} completed`,
    });
  } catch (err) {
    req.log.error({ err, reference }, "Transfer error");
    res.status(500).json({ error: "InternalError", message: "Transfer failed" });
  }
});

// POST /transactions/webhook
router.post("/webhook", async (req, res) => {
  const schema = z.object({
    reference: z.string(),
    status: z.enum(["SUCCESS", "FAILED"]),
    providerReference: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: "Invalid webhook payload" });
    return;
  }

  const { reference, status, providerReference, metadata } = parse.data;

  try {
    const [tx] = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.reference, reference))
      .limit(1);

    if (!tx) {
      res.status(404).json({ error: "NotFound", message: "Transaction not found" });
      return;
    }

    if (tx.status !== "PENDING") {
      res.json({ success: true, message: "Transaction already processed" });
      return;
    }

    await db
      .update(transactionsTable)
      .set({
        status,
        providerReference: providerReference ?? tx.providerReference,
        metadata: { ...(tx.metadata as object), webhookAt: new Date().toISOString(), ...(metadata ?? {}) },
        updatedAt: new Date(),
      })
      .where(eq(transactionsTable.id, tx.id));

    if (status === "SUCCESS" && tx.type === "DEPOSIT") {
      const [wallet] = await db
        .select()
        .from(walletsTable)
        .where(and(eq(walletsTable.userId, tx.userId), eq(walletsTable.currency, tx.currency)))
        .limit(1);

      if (wallet) {
        await db
          .update(walletsTable)
          .set({
            balance: (parseFloat(wallet.balance) + parseFloat(tx.netAmount)).toString(),
            updatedAt: new Date(),
          })
          .where(eq(walletsTable.id, wallet.id));
      }
    }

    req.log.info({ reference, status, txId: tx.id }, "Webhook processed");
    res.json({ success: true, message: "Webhook processed" });
  } catch (err) {
    req.log.error({ err, reference }, "Webhook error");
    res.status(500).json({ error: "InternalError", message: "Webhook processing failed" });
  }
});

export default router;
