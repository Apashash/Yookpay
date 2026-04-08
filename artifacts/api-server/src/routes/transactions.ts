import { Router } from "express";
import { db, pool } from "@workspace/db";
import { transactionsTable, walletsTable, userFeesTable } from "@workspace/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/authMiddleware";
import { transactionRateLimit } from "../middlewares/rateLimitMiddleware";
import { createNpPayment, createNpPayout, getNpMinAmount } from "../lib/nowpayments";
import { convertCurrency, getRateFromUsd, getMinExchangeAmount } from "../lib/fxRates";
import { convertWithAdminRate, getEffectiveRate, getExchangeFeeRate } from "../lib/adminRates";
import {
  calculateFee,
  calculateFeeWithRate,
  generateReference,
  CURRENCY_MAP,
  FEE_TABLE,
  type Country,
  type Operator,
  type TransactionType,
} from "../services/feeService";

import { callPixPayAirtime, getOperatorFlow, getPixPayTransactionStatus, type PixPayCallParams } from "../lib/pixpay";
import { z } from "zod";

const DEFAULT_MARGIN = 0.015; // YookPay margin applied on top of PixPay fee

const OPERATOR_LABELS: Record<string, string> = {
  MTN:      "MTN Mobile Money",
  ORANGE:   "Orange Money",
  MOOV:     "Moov Money",
  WAVE:     "Wave",
  AIRTEL:   "Airtel Money",
  VODACOM:  "M-Pesa (Vodacom)",
  AFRICELL: "Africell Money",
  QMONEY:   "QMoney",
  CELLCOM:  "Cellcom Money",
  FREE:     "Free Money",
  TOGOCEL:  "T-Money (Togocel)",
};

const GLOBAL_COUNTRY = "ZZ";
const GLOBAL_OPERATOR = "GLOBAL";

// Look up the effective fee breakdown for a user (pixpay + margin separately)
// Returns { total, pixpay, margin } or undefined if country/operator not found in FEE_TABLE
async function getUserOperatorFeeRate(
  userId: number,
  country: string,
  operator: string,
  type: "DEPOSIT" | "WITHDRAWAL",
): Promise<{ total: number; pixpay: number; margin: number } | undefined> {
  try {
    const result = await pool.query<{
      pixpay_deposit: string; pixpay_withdrawal: string;
      margin_deposit: string; margin_withdrawal: string;
    }>(
      "SELECT pixpay_deposit, pixpay_withdrawal, margin_deposit, margin_withdrawal FROM user_operator_fees WHERE user_id = $1 AND country = $2 AND operator = $3",
      [userId, country, operator]
    );
    if (result.rows.length) {
      const r = result.rows[0];
      const pixpay = parseFloat(type === "DEPOSIT" ? r.pixpay_deposit : r.pixpay_withdrawal);
      const margin = parseFloat(type === "DEPOSIT" ? r.margin_deposit : r.margin_withdrawal);
      return { total: pixpay + margin, pixpay, margin };
    }
    // No custom config → use FEE_TABLE rate + DEFAULT_MARGIN
    const defaultPixpay = FEE_TABLE[country as Country]?.[operator as Operator]?.[type]?.rate;
    if (defaultPixpay !== undefined) {
      return { total: defaultPixpay + DEFAULT_MARGIN, pixpay: defaultPixpay, margin: DEFAULT_MARGIN };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

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

// GET /transactions/crypto-min-amount — public, no auth needed
router.get("/crypto-min-amount", async (_req, res) => {
  try {
    const minAmount = await getNpMinAmount("usdttrc20", "usdttrc20");
    const rounded = Math.ceil(minAmount);
    res.json({ minAmount: rounded, currency: "USDT", network: "TRC-20" });
  } catch {
    res.json({ minAmount: 20, currency: "USDT", network: "TRC-20" });
  }
});

// GET /transactions/fx-rate?from=XAF&to=USDT&amount=1000
router.get("/fx-rate", authMiddleware, async (req: AuthRequest, res) => {
  const { from, to, amount } = req.query as { from?: string; to?: string; amount?: string };
  if (!from || !to) {
    res.status(400).json({ error: "ValidationError", message: "from and to required" });
    return;
  }
  try {
    const amt = parseFloat(amount ?? "1");
    const converted = await convertWithAdminRate(amt, from, to);
    const usdRate = await getRateFromUsd(from);
    const minAmount = await getMinExchangeAmount(from);
    const effectiveRate = await getEffectiveRate(from, to);
    const feeRate = await getExchangeFeeRate();
    res.json({ from, to, amount: amt, converted, rate: effectiveRate, usdRate, minAmount, feeRate });
  } catch {
    res.status(500).json({ error: "InternalError", message: "FX rate unavailable" });
  }
});

// GET /transactions/:id  — status polling endpoint
router.get("/:id", authMiddleware, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ValidationError", message: "Invalid transaction id" });
    return;
  }
  try {
    const [tx] = await db
      .select()
      .from(transactionsTable)
      .where(and(eq(transactionsTable.id, id), eq(transactionsTable.userId, req.userId!)))
      .limit(1);
    if (!tx) {
      res.status(404).json({ error: "NotFound", message: "Transaction not found" });
      return;
    }

    // Auto-sync with PixPay when transaction is stuck in PENDING and we have a provider reference
    if (tx.status === "PENDING" && tx.providerReference) {
      try {
        const pixStatus = await getPixPayTransactionStatus(tx.providerReference, tx.currency);
        if (pixStatus && (pixStatus.isSuccess || pixStatus.isFailed)) {
          const newStatus = pixStatus.isSuccess ? "SUCCESS" : "FAILED";
          req.log.info({ txId: tx.id, pixStatus: pixStatus.state, newStatus }, "Auto-sync from PixPay status check");

          await db
            .update(transactionsTable)
            .set({
              status: newStatus,
              metadata: {
                ...(tx.metadata as object ?? {}),
                pixStateSynced: pixStatus.state,
                syncedAt: new Date().toISOString(),
              },
              updatedAt: new Date(),
            })
            .where(eq(transactionsTable.id, tx.id));

          if (pixStatus.isSuccess && tx.type === "DEPOSIT") {
            const [wallet] = await db
              .select()
              .from(walletsTable)
              .where(and(eq(walletsTable.userId, tx.userId), eq(walletsTable.currency, tx.currency)))
              .limit(1);
            if (wallet) {
              const credit = parseFloat(tx.netAmount);
              await db
                .update(walletsTable)
                .set({ balance: (parseFloat(wallet.balance) + credit).toFixed(2), updatedAt: new Date() })
                .where(eq(walletsTable.id, wallet.id));
              req.log.info({ txId: tx.id, credit, currency: tx.currency }, "Auto-sync DEPOSIT credited wallet");
            }
          } else if (pixStatus.isFailed && tx.type === "WITHDRAWAL") {
            const [wallet] = await db
              .select()
              .from(walletsTable)
              .where(and(eq(walletsTable.userId, tx.userId), eq(walletsTable.currency, tx.currency)))
              .limit(1);
            if (wallet) {
              const refund = parseFloat(tx.netAmount) + parseFloat(tx.fee);
              await db
                .update(walletsTable)
                .set({ balance: (parseFloat(wallet.balance) + refund).toFixed(2), updatedAt: new Date() })
                .where(eq(walletsTable.id, wallet.id));
              req.log.info({ txId: tx.id, refund, currency: tx.currency }, "Auto-sync WITHDRAWAL FAILED refunded wallet");
            }
          }

          // Re-fetch the updated transaction
          const [updated] = await db
            .select()
            .from(transactionsTable)
            .where(eq(transactionsTable.id, id))
            .limit(1);
          if (updated) {
            res.json(formatTx(updated));
            return;
          }
        }
      } catch (syncErr) {
        req.log.warn({ syncErr, txId: tx.id }, "PixPay auto-sync failed — returning current status");
      }
    }

    res.json(formatTx(tx));
  } catch (err) {
    req.log.error({ err }, "Get transaction by id error");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch transaction" });
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
    const opBreakdown = (type === "DEPOSIT" || type === "WITHDRAWAL")
      ? await getUserOperatorFeeRate(req.userId!, country, operator, type)
      : undefined;
    const legacyRate = opBreakdown !== undefined ? undefined : await getUserFeeRate(req.userId!, country, operator, type as TransactionType);
    const userRate = opBreakdown?.total ?? legacyRate;
    const breakdown = userRate !== undefined
      ? calculateFeeWithRate(amount, country as Country, operator as Operator, type as TransactionType, userRate)
      : calculateFee(amount, country as Country, operator as Operator, type as TransactionType);
    res.json(breakdown);
  } catch (err) {
    req.log.error({ err }, "Fee preview error");
    res.status(400).json({ error: "BadRequest", message: "Cannot calculate fee for this combination" });
  }
});

// Helper: get PixPay service_id for operator+country+currency+type
// Country-specific entry takes priority over NULL (global) entries.
async function getPixPayServiceId(
  operator: string,
  currency: string,
  type: "DEPOSIT" | "WITHDRAWAL",
  country?: string,
): Promise<number | null> {
  try {
    const result = await db.execute(
      sql`SELECT service_id FROM pixpay_services
          WHERE operator = ${operator.toUpperCase()}
            AND currency = ${currency.toUpperCase()}
            AND type = ${type}
            AND active = true
            AND (country = ${country?.toUpperCase() ?? null} OR country IS NULL)
          ORDER BY (country IS NOT NULL) DESC
          LIMIT 1`,
    );
    if (result.rows.length > 0) {
      const sid = parseInt(String((result.rows[0] as { service_id: unknown }).service_id));
      return sid > 0 ? sid : null;
    }
  } catch {
    // table may not exist yet - ignore
  }
  return null;
}

// Helper: get platform_config value
async function getPlatformConfig(key: string): Promise<string | null> {
  try {
    const result = await db.execute(
      sql`SELECT value FROM platform_config WHERE key = ${key} LIMIT 1`,
    );
    if (result.rows.length > 0) return String((result.rows[0] as { value: unknown }).value);
  } catch {
    // ignore
  }
  return null;
}

// POST /transactions/deposit
router.post("/deposit", authMiddleware, transactionRateLimit, async (req: AuthRequest, res) => {
  const schema = z.object({
    amount: z.number().min(100),
    country: z.string().min(2),
    operator: z.string().min(2),
    phone: z.string().min(6),
    feeBearer: z.enum(["SENDER", "RECIPIENT"]).default("SENDER"),
    omOtp: z.string().optional(),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: "Invalid deposit parameters" });
    return;
  }

  const { amount, country, operator, phone, feeBearer, omOtp } = parse.data;
  const currency = CURRENCY_MAP[country as Country];
  const reference = generateReference();
  const flow = getOperatorFlow(operator);

  // Orange Money requires OTP
  if (flow === "OTP" && !omOtp) {
    res.status(400).json({
      error: "OtpRequired",
      message: "Un code OTP Orange Money est requis. Composez #144*82# pour l'obtenir.",
    });
    return;
  }

  try {
    const opBreakdown = await getUserOperatorFeeRate(req.userId!, country, operator, "DEPOSIT");
    const legacyRate = opBreakdown !== undefined ? undefined : await getUserFeeRate(req.userId!, country, operator, "DEPOSIT");
    const userRate = opBreakdown?.total ?? legacyRate;
    const feeBreakdown = userRate !== undefined
      ? calculateFeeWithRate(amount, country as Country, operator as Operator, "DEPOSIT", userRate)
      : calculateFee(amount, country as Country, operator as Operator, "DEPOSIT");
    const yookpayMarginAmount = Math.round(amount * (opBreakdown?.margin ?? DEFAULT_MARGIN));

    // Check service availability BEFORE creating the transaction
    const serviceId = await getPixPayServiceId(operator, currency, "DEPOSIT", country);
    if (serviceId === null) {
      res.status(503).json({
        error: "ServiceNotAvailable",
        message: `Le dépôt via ${OPERATOR_LABELS[operator] ?? operator} (${currency}) n'est pas encore disponible. Contactez le support YookPay.`,
      });
      return;
    }

    // ─── Fee semantics based on feeBearer ───────────────────────────────────
    // SENDER pays   → user enters NET (wallet credit). Phone is charged net+fee.
    // RECIPIENT pays → user enters GROSS (phone charge). Wallet credits gross-fee.
    const feeAmt = feeBreakdown.feeAmount;
    const pixPayAmount   = feeBearer === "SENDER" ? amount + feeAmt : amount;
    const walletNetAmount = feeBearer === "SENDER" ? amount          : Math.max(amount - feeAmt, 0);
    // ─────────────────────────────────────────────────────────────────────────

    const [tx] = await db
      .insert(transactionsTable)
      .values({
        userId: req.userId!,
        type: "DEPOSIT",
        status: "PENDING",
        amount: amount.toString(),
        fee: feeAmt.toString(),
        netAmount: walletNetAmount.toString(),
        currency,
        country,
        operator,
        phone,
        reference,
        feeRate: feeBreakdown.feeRate.toString(),
        yookpayMargin: yookpayMarginAmount.toString(),
        metadata: { initiatedAt: new Date().toISOString(), feeBearer, flow, pixPayAmount },
      })
      .returning();

    req.log.info(
      { txId: tx.id, reference, userId: req.userId, amount, pixPayAmount, walletNetAmount, currency, operator, country, flow, feeBearer },
      "Deposit transaction created — calling PixPay"
    );

    const pixParams: PixPayCallParams = {
      currency,
      serviceId,
      amount: pixPayAmount,
      phone,
      customData: reference,
      omOtp,
    };

    if (flow === "WAVE") {
      const waveBusinessNameId = await getPlatformConfig("WAVE_BUSINESS_NAME_ID");
      const waveRedirectUrl = await getPlatformConfig("WAVE_REDIRECT_URL");
      const waveRedirectErrorUrl = await getPlatformConfig("WAVE_REDIRECT_ERROR_URL");
      if (waveBusinessNameId) {
        pixParams.businessNameId = waveBusinessNameId;
        pixParams.redirectUrl = waveRedirectUrl ?? "";
        pixParams.redirectErrorUrl = waveRedirectErrorUrl ?? "";
      }
    }

    const pixResult = await callPixPayAirtime(pixParams);

    await db
      .update(transactionsTable)
      .set({
        providerReference: pixResult.pixTransactionId,
        metadata: {
          initiatedAt: new Date().toISOString(),
          feeBearer,
          flow,
          pixState: pixResult.state,
          pixMessage: pixResult.message,
          smsLink: pixResult.smsLink,
        },
        updatedAt: new Date(),
      })
      .where(eq(transactionsTable.id, tx.id));

    req.log.info(
      { txId: tx.id, pixId: pixResult.pixTransactionId, pixState: pixResult.state },
      "PixPay deposit initiated — awaiting IPN"
    );

    res.status(201).json({
      transaction: formatTx(tx),
      feeBreakdown,
      feeBearer,
      flow,
      pixState: pixResult.state,
      smsLink: pixResult.smsLink,
      message: pixResult.message,
      pending: true,
    });
  } catch (err) {
    req.log.error({ err, reference }, "Deposit error");
    const msg = err instanceof Error ? err.message : "Dépôt échoué";
    res.status(500).json({ error: "InternalError", message: msg });
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
    let yookpayMarginAmount = 0;
    try {
      const opBreakdown = await getUserOperatorFeeRate(req.userId!, country, operator, "WITHDRAWAL");
      const legacyRate = opBreakdown !== undefined ? undefined : await getUserFeeRate(req.userId!, country, operator, "WITHDRAWAL");
      const userRate = opBreakdown?.total ?? legacyRate;
      feeBreakdown = userRate !== undefined
        ? calculateFeeWithRate(amount, country as Country, operator as Operator, "WITHDRAWAL", userRate)
        : calculateFee(amount, country as Country, operator as Operator, "WITHDRAWAL");
      yookpayMarginAmount = Math.round(amount * (opBreakdown?.margin ?? DEFAULT_MARGIN));
    } catch {
      res.status(400).json({ error: "BadRequest", message: "Impossible de calculer les frais pour cet opérateur." });
      return;
    }

    // ─── Fee semantics based on feeBearer ───────────────────────────────────
    // SENDER pays   → user enters NET (phone receives). Wallet debited net+fee.
    // RECIPIENT pays → user enters GROSS (wallet debit). Phone receives gross-fee.
    const wdFeeAmt = feeBreakdown.feeAmount;
    const walletDebit  = feeBearer === "SENDER" ? amount + wdFeeAmt : amount;
    const pixPayAmount = feeBearer === "SENDER" ? amount             : Math.max(amount - wdFeeAmt, 0);
    const phoneNetAmount = pixPayAmount; // what phone actually receives
    // ─────────────────────────────────────────────────────────────────────────

    if (balance < walletDebit) {
      res.status(400).json({
        error: "InsufficientFunds",
        message: `Solde du portefeuille ${currency} insuffisant pour couvrir le montant${feeBearer === "SENDER" ? " et les frais" : ""} (nécessaire : ${walletDebit.toLocaleString("fr-FR")} ${currency}, disponible : ${balance.toLocaleString("fr-FR")} ${currency})`,
      });
      return;
    }

    const flow = getOperatorFlow(operator);

    // Check service availability BEFORE touching the wallet
    const serviceId = await getPixPayServiceId(operator, currency, "WITHDRAWAL", country);
    if (serviceId === null) {
      res.status(503).json({
        error: "ServiceNotAvailable",
        message: `Le retrait via ${OPERATOR_LABELS[operator] ?? operator} (${currency}) n'est pas encore disponible. Contactez le support YookPay.`,
      });
      return;
    }

    // Deduct wallet BEFORE calling PixPay (IPN/expiry will refund on FAILED)
    const newBalance = parseFloat(wallet.balance) - walletDebit;
    await db
      .update(walletsTable)
      .set({ balance: Math.max(newBalance, 0).toFixed(2), updatedAt: new Date() })
      .where(eq(walletsTable.id, wallet.id));

    const [tx] = await db
      .insert(transactionsTable)
      .values({
        userId: req.userId!,
        type: "WITHDRAWAL",
        status: "PENDING",
        amount: amount.toString(),
        fee: wdFeeAmt.toString(),
        netAmount: phoneNetAmount.toString(), // what phone receives (refund = netAmount + fee = walletDebit)
        currency,
        country,
        operator,
        phone,
        reference,
        feeRate: feeBreakdown.feeRate.toString(),
        yookpayMargin: yookpayMarginAmount.toString(),
        metadata: { initiatedAt: new Date().toISOString(), feeBearer, flow, walletDebit, pixPayAmount },
      })
      .returning();

    req.log.info(
      { txId: tx.id, reference, userId: req.userId, amount, pixPayAmount, walletDebit, currency, operator, flow, feeBearer },
      "Withdrawal transaction created — wallet reserved — calling PixPay"
    );

    const pixParams: PixPayCallParams = {
      currency,
      serviceId,
      amount: pixPayAmount,
      phone,
      customData: reference,
    };

    if (flow === "WAVE") {
      const waveBusinessNameId = await getPlatformConfig("WAVE_BUSINESS_NAME_ID");
      const waveRedirectUrl = await getPlatformConfig("WAVE_REDIRECT_URL");
      const waveRedirectErrorUrl = await getPlatformConfig("WAVE_REDIRECT_ERROR_URL");
      if (waveBusinessNameId) {
        pixParams.businessNameId = waveBusinessNameId;
        pixParams.redirectUrl = waveRedirectUrl ?? "";
        pixParams.redirectErrorUrl = waveRedirectErrorUrl ?? "";
      }
    }

    const pixResult = await callPixPayAirtime(pixParams);

    await db
      .update(transactionsTable)
      .set({
        providerReference: pixResult.pixTransactionId,
        metadata: {
          initiatedAt: new Date().toISOString(),
          feeBearer,
          flow,
          pixState: pixResult.state,
          pixMessage: pixResult.message,
          smsLink: pixResult.smsLink,
        },
        updatedAt: new Date(),
      })
      .where(eq(transactionsTable.id, tx.id));

    req.log.info(
      { txId: tx.id, pixId: pixResult.pixTransactionId, pixState: pixResult.state },
      "PixPay withdrawal initiated — awaiting IPN"
    );

    res.status(201).json({
      transaction: formatTx(tx),
      feeBreakdown,
      feeBearer,
      flow,
      pixState: pixResult.state,
      smsLink: pixResult.smsLink,
      message: pixResult.message,
      pending: true,
    });
  } catch (err) {
    req.log.error({ err, reference }, "Withdrawal error");
    const msg = err instanceof Error ? err.message : "Retrait échoué";
    res.status(500).json({ error: "InternalError", message: msg });
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

  // Transfer fee: user-specific override > platform conversion fee > default 1.9%
  let platformRate = 0.019;
  try {
    const pairs = [fromCurrency, toCurrency].sort().join(":");
    const res = await db.execute(sql`SELECT rate FROM conversion_fees WHERE pair = ${pairs} LIMIT 1`);
    if (res.rows.length > 0) {
      platformRate = parseFloat(String((res.rows[0] as any).rate));
    }
  } catch { /* ignore, use default */ }
  const globalTransferRate = await getUserFeeRate(req.userId!, GLOBAL_COUNTRY, GLOBAL_OPERATOR, "TRANSFER") ?? platformRate;
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

// POST /transactions/crypto-deposit
// Creates a NowPayments USDT deposit address for the user
router.post("/crypto-deposit", authMiddleware, transactionRateLimit, async (req: AuthRequest, res) => {
  const schema = z.object({
    amountUsdt: z.number().min(1, "Minimum 1 USDT"),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: "Montant USDT invalide" });
    return;
  }
  const { amountUsdt } = parse.data;

  // Validate against NowPayments minimum before creating anything
  try {
    const minAmount = await getNpMinAmount("usdttrc20", "usdttrc20");
    const minRounded = Math.ceil(minAmount);
    if (amountUsdt < minRounded) {
      res.status(400).json({
        error: "BelowMinimum",
        message: `Montant minimum de dépôt : ${minRounded} USDT`
      });
      return;
    }
  } catch {
    // If we can't reach NowPayments min-amount API, apply a safe fallback of 20 USDT
    if (amountUsdt < 20) {
      res.status(400).json({
        error: "BelowMinimum",
        message: "Montant minimum de dépôt : 20 USDT"
      });
      return;
    }
  }

  const reference = generateReference();

  try {
    const callbackUrl = `${process.env.APP_URL ?? ""}/api/nowpayments/ipn`;

    const [tx] = await db
      .insert(transactionsTable)
      .values({
        userId: req.userId!,
        type: "DEPOSIT",
        status: "PENDING",
        amount: amountUsdt.toString(),
        fee: "0",
        netAmount: amountUsdt.toFixed(8),
        currency: "USDT",
        country: "ZZ",
        operator: "CRYPTO",
        reference,
        feeRate: "0",
        metadata: { provider: "NOWPAYMENTS", initiatedAt: new Date().toISOString() },
      })
      .returning();

    let payAddress = null;
    let npPaymentId = null;
    let payAmount = amountUsdt;

    try {
      const npResult = await createNpPayment({
        priceAmount: amountUsdt,
        priceCurrency: "usd",
        payCurrency: "usdttrc20",
        orderId: reference,
        orderDescription: `YookPay USDT deposit - user ${req.userId}`,
        ipnCallbackUrl: callbackUrl,
      });
      payAddress = npResult.pay_address;
      npPaymentId = npResult.payment_id;
      payAmount = npResult.pay_amount;

      await db.update(transactionsTable).set({
        providerReference: npPaymentId,
        metadata: {
          provider: "NOWPAYMENTS",
          nowpaymentsPaymentId: npPaymentId,
          payAddress,
          payCurrency: "usdttrc20",
          payAmount,
          initiatedAt: new Date().toISOString(),
        },
      }).where(eq(transactionsTable.id, tx.id));
    } catch (npErr: any) {
      req.log.error({ err: npErr }, "NowPayments API error");
      // Clean up the pending transaction since NowPayments failed
      await db.delete(transactionsTable).where(eq(transactionsTable.id, tx.id));
      // Extract the meaningful part of the NowPayments error (strip "NowPayments API error 4xx: " prefix)
      const rawMsg: string = npErr?.message ?? "Erreur NowPayments inconnue";
      const detail = rawMsg.replace(/^NowPayments API error \d+:\s*/i, "");
      res.status(400).json({ error: "NowPaymentsError", message: detail });
      return;
    }

    res.status(201).json({
      transaction: formatTx(tx),
      payAddress,
      npPaymentId,
      payAmount,
      payCurrency: "USDTTRC20",
      network: "Tron (TRC-20)",
      message: "Envoyez exactement le montant USDT indiqué à l'adresse ci-dessous. La transaction sera confirmée sous 10-20 minutes.",
    });
  } catch (err) {
    req.log.error({ err }, "Crypto deposit error");
    res.status(500).json({ error: "InternalError", message: "Erreur lors de la création du dépôt crypto" });
  }
});

// POST /transactions/crypto-withdraw
// Request a USDT withdrawal to an external crypto address
router.post("/crypto-withdraw", authMiddleware, transactionRateLimit, async (req: AuthRequest, res) => {
  const schema = z.object({
    amountUsdt: z.number().min(1, "Minimum 1 USDT"),
    address: z.string().min(20, "Adresse crypto invalide"),
    network: z.enum(["TRC20", "ERC20"]).default("TRC20"),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: parse.error.errors[0]?.message ?? "Paramètres invalides" });
    return;
  }
  const { amountUsdt, address, network } = parse.data;

  // Fee 1% on crypto withdrawals
  const feeRate = 0.01;
  const fee = parseFloat((amountUsdt * feeRate).toFixed(8));
  const netAmount = parseFloat((amountUsdt - fee).toFixed(8));

  try {
    const [usdtWallet] = await db
      .select()
      .from(walletsTable)
      .where(and(eq(walletsTable.userId, req.userId!), eq(walletsTable.currency, "USDT")))
      .limit(1);

    const lockedUsdtBal = parseFloat((usdtWallet as any)?.locked_balance ?? "0");
    const available = usdtWallet
      ? parseFloat(usdtWallet.balance) - lockedUsdtBal
      : 0;

    if (available < amountUsdt) {
      const lockedMsg = lockedUsdtBal > 0 ? ` (${lockedUsdtBal.toFixed(4)} USDT verrouillés en échange en attente d'admin)` : "";
      res.status(400).json({ error: "InsufficientFunds", message: `Solde USDT disponible insuffisant — ${available.toFixed(4)} USDT disponibles${lockedMsg}` });
      return;
    }

    const reference = generateReference();

    // Deduct from wallet immediately (lock funds)
    await db.update(walletsTable).set({
      balance: (parseFloat(usdtWallet.balance) - amountUsdt).toFixed(8),
      updatedAt: new Date(),
    }).where(eq(walletsTable.id, usdtWallet.id));

    const [tx] = await db
      .insert(transactionsTable)
      .values({
        userId: req.userId!,
        type: "WITHDRAWAL",
        status: "PENDING",
        amount: amountUsdt.toString(),
        fee: fee.toString(),
        netAmount: netAmount.toString(),
        currency: "USDT",
        country: "ZZ",
        operator: "CRYPTO",
        reference,
        feeRate: feeRate.toString(),
        metadata: {
          provider: "NOWPAYMENTS",
          address,
          network,
          initiatedAt: new Date().toISOString(),
        },
      })
      .returning();

    let npPayoutId = null;
    try {
      const payCurrency = network === "TRC20" ? "usdttrc20" : "usdterc20";
      const callbackUrl = `${process.env.APP_URL ?? ""}/api/nowpayments/ipn`;
      const npResult = await createNpPayout({
        address,
        amount: netAmount,
        currency: payCurrency,
        ipnCallbackUrl: callbackUrl,
        extraId: reference,
      });
      npPayoutId = npResult.id;
      const withdrawal = npResult.withdrawals?.[0];

      await db.update(transactionsTable).set({
        providerReference: npPayoutId,
        metadata: {
          provider: "NOWPAYMENTS",
          address,
          network,
          npPayoutId,
          npWithdrawalId: withdrawal?.id ?? null,
          initiatedAt: new Date().toISOString(),
        },
        status: "SUCCESS",
        updatedAt: new Date(),
      }).where(eq(transactionsTable.id, tx.id));
    } catch (npErr) {
      const errMsg = npErr instanceof Error ? npErr.message : String(npErr);
      req.log.error({ err: npErr }, "NowPayments payout failed");

      // Refund the wallet and mark transaction FAILED
      await db.update(walletsTable).set({
        balance: usdtWallet.balance, // restore original balance
        updatedAt: new Date(),
      }).where(eq(walletsTable.id, usdtWallet.id));
      await db.update(transactionsTable).set({
        status: "FAILED",
        metadata: {
          provider: "NOWPAYMENTS",
          address,
          network,
          error: errMsg,
          initiatedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      }).where(eq(transactionsTable.id, tx.id));

      res.status(503).json({
        error: "PayoutFailed",
        message: "Le retrait crypto est temporairement indisponible. Vos fonds ont été remboursés sur votre portefeuille. Veuillez réessayer plus tard ou contacter le support.",
      });
      return;
    }

    res.status(201).json({
      transaction: formatTx(tx),
      address,
      network,
      netAmount,
      fee,
      message: "Votre retrait crypto est en cours de traitement.",
    });
  } catch (err) {
    req.log.error({ err }, "Crypto withdraw error");
    res.status(500).json({ error: "InternalError", message: "Erreur lors du retrait crypto" });
  }
});

// POST /transactions/exchange-step1
// Step 1: XAF/XOF/CDF → USDT (automatic, credits USDT wallet instantly)
router.post("/exchange-step1", authMiddleware, transactionRateLimit, async (req: AuthRequest, res) => {
  const schema = z.object({
    fromCurrency: z.enum(["XAF", "XOF", "CDF"]),
    amount: z.number().positive("Montant requis"),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: parse.error.errors[0]?.message ?? "Paramètres invalides" });
    return;
  }
  const { fromCurrency, amount } = parse.data;

  try {
    const minAmount = await getMinExchangeAmount(fromCurrency);
    if (amount < minAmount) {
      res.status(400).json({ error: "MinimumAmount", message: `Montant minimum : ${minAmount.toLocaleString("fr")} ${fromCurrency} (équivalent à 16 000 XAF)` });
      return;
    }

    const [fromWallet] = await db
      .select()
      .from(walletsTable)
      .where(and(eq(walletsTable.userId, req.userId!), eq(walletsTable.currency, fromCurrency)))
      .limit(1);

    if (!fromWallet || parseFloat(fromWallet.balance) < amount) {
      res.status(400).json({ error: "InsufficientFunds", message: `Solde ${fromCurrency} insuffisant` });
      return;
    }

    const [usdtWallet] = await db
      .select()
      .from(walletsTable)
      .where(and(eq(walletsTable.userId, req.userId!), eq(walletsTable.currency, "USDT")))
      .limit(1);

    if (!usdtWallet) {
      res.status(404).json({ error: "NotFound", message: "Wallet USDT introuvable" });
      return;
    }

    // Exchange fee: admin-configured or 2% default
    const feeRate = await getExchangeFeeRate();
    const fee = Math.round(amount * feeRate);
    const netAmount = amount - fee;

    // Convert to USDT via admin rate (or live FX fallback)
    const usdtAmount = await convertWithAdminRate(netAmount, fromCurrency, "USDT");
    const rate = await getEffectiveRate(fromCurrency, "USDT");

    const reference = generateReference();
    const countryMap: Record<string, string> = { XAF: "CM", XOF: "SN", CDF: "CD" };

    // Deduct from source wallet
    await db.update(walletsTable).set({
      balance: (parseFloat(fromWallet.balance) - amount).toFixed(2),
      updatedAt: new Date(),
    }).where(eq(walletsTable.id, fromWallet.id));

    // Credit USDT wallet
    await db.update(walletsTable).set({
      balance: (parseFloat(usdtWallet.balance) + usdtAmount).toFixed(8),
      updatedAt: new Date(),
    }).where(eq(walletsTable.id, usdtWallet.id));

    // Create transaction record
    const [tx] = await db
      .insert(transactionsTable)
      .values({
        userId: req.userId!,
        type: "TRANSFER",
        status: "SUCCESS",
        amount: amount.toString(),
        fee: fee.toString(),
        netAmount: usdtAmount.toFixed(8),
        currency: fromCurrency,
        country: (countryMap[fromCurrency] ?? "CM") as any,
        operator: "EXCHANGE",
        reference,
        feeRate: feeRate.toString(),
        metadata: {
          exchangeType: "FIAT_TO_USDT",
          fromCurrency,
          toCurrency: "USDT",
          fromAmount: amount,
          usdtAmount,
          rate,
          completedAt: new Date().toISOString(),
        },
      })
      .returning();

    // Create crypto_exchange record (status: STEP1_DONE = USDT credited, can optionally do step 2)
    await db.execute(sql`
      INSERT INTO crypto_exchanges (user_id, from_currency, to_currency, from_amount, usdt_amount, exchange_rate, fee_amount, status, tx_step1_id)
      VALUES (${req.userId!}, ${fromCurrency}, 'USDT', ${amount}, ${usdtAmount}, ${rate}, ${fee}, 'STEP1_DONE', ${tx.id})
    `);

    res.status(201).json({
      transaction: formatTx(tx),
      fromCurrency,
      fromAmount: amount,
      usdtAmount: parseFloat(usdtAmount.toFixed(8)),
      rate,
      fee,
      message: `${amount.toLocaleString("fr")} ${fromCurrency} ont été convertis en ${usdtAmount.toFixed(6)} USDT et crédités sur votre wallet.`,
    });
  } catch (err) {
    req.log.error({ err }, "Exchange step1 error");
    res.status(500).json({ error: "InternalError", message: "Erreur lors de l'échange" });
  }
});

// POST /transactions/exchange-step2
// Step 2: USDT → XAF/XOF/CDF (locks USDT, sends request to admin)
router.post("/exchange-step2", authMiddleware, transactionRateLimit, async (req: AuthRequest, res) => {
  const schema = z.object({
    amountUsdt: z.number().min(1, "Minimum 1 USDT"),
    toCurrency: z.enum(["XAF", "XOF", "CDF"]),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: parse.error.errors[0]?.message ?? "Paramètres invalides" });
    return;
  }
  const { amountUsdt, toCurrency } = parse.data;

  try {
    const [usdtWallet] = await db
      .select()
      .from(walletsTable)
      .where(and(eq(walletsTable.userId, req.userId!), eq(walletsTable.currency, "USDT")))
      .limit(1);

    // Check for available (unlocked) USDT
    const lockedBal = parseFloat((usdtWallet as any)?.locked_balance ?? "0");
    const totalBal = usdtWallet ? parseFloat(usdtWallet.balance) : 0;
    const available = totalBal - lockedBal;

    if (available < amountUsdt) {
      const lockedMsg = lockedBal > 0 ? ` (${lockedBal.toFixed(4)} USDT verrouillés en échange en cours)` : "";
      res.status(400).json({ error: "InsufficientFunds", message: `Solde USDT disponible insuffisant — ${available.toFixed(4)} USDT disponibles${lockedMsg}` });
      return;
    }

    // Fee: admin-configured or 2% default
    const feeRate = await getExchangeFeeRate();
    const fee = parseFloat((amountUsdt * feeRate).toFixed(8));
    const netUsdt = amountUsdt - fee;

    // Estimated fiat amount via admin rate (or live FX fallback)
    const estimatedFiat = await convertWithAdminRate(netUsdt, "USDT", toCurrency);
    const rate = await getEffectiveRate("USDT", toCurrency);

    const reference = generateReference();
    const countryMap: Record<string, string> = { XAF: "CM", XOF: "SN", CDF: "CD" };

    // Lock USDT balance
    await db.execute(sql`
      UPDATE wallets SET locked_balance = locked_balance + ${amountUsdt}, updated_at = NOW()
      WHERE user_id = ${req.userId!} AND currency = 'USDT'
    `);

    // Create transaction (PENDING until admin confirms)
    const [tx] = await db
      .insert(transactionsTable)
      .values({
        userId: req.userId!,
        type: "TRANSFER",
        status: "PENDING",
        amount: amountUsdt.toString(),
        fee: fee.toString(),
        netAmount: estimatedFiat.toFixed(2),
        currency: "USDT",
        country: (countryMap[toCurrency] ?? "CM") as any,
        operator: "EXCHANGE",
        reference,
        feeRate: feeRate.toString(),
        metadata: {
          exchangeType: "USDT_TO_FIAT",
          fromCurrency: "USDT",
          toCurrency,
          amountUsdt,
          estimatedFiat,
          rate,
          pendingSince: new Date().toISOString(),
        },
      })
      .returning();

    // Create crypto_exchange record with PENDING_ADMIN status
    await db.execute(sql`
      INSERT INTO crypto_exchanges (user_id, from_currency, to_currency, from_amount, usdt_amount, to_amount, exchange_rate, fee_amount, status, tx_step2_id)
      VALUES (${req.userId!}, 'USDT', ${toCurrency}, ${amountUsdt}, ${amountUsdt}, ${estimatedFiat}, ${rate}, ${fee}, 'PENDING_ADMIN', ${tx.id})
    `);

    res.status(201).json({
      transaction: formatTx(tx),
      amountUsdt,
      toCurrency,
      estimatedFiat: parseFloat(estimatedFiat.toFixed(2)),
      rate,
      fee,
      message: `Demande envoyée à l'admin. Votre wallet ${toCurrency} sera crédité de ≈ ${estimatedFiat.toFixed(0)} ${toCurrency} sous 24-48h après confirmation.`,
    });
  } catch (err) {
    req.log.error({ err }, "Exchange step2 error");
    res.status(500).json({ error: "InternalError", message: "Erreur lors de la demande d'échange" });
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
