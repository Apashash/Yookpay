import { Router } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/authMiddleware";
import { z } from "zod";
import crypto from "crypto";
import {
  calculateFee,
  calculateFeeWithRate,
  generateReference,
  CURRENCY_MAP,
  FEE_TABLE,
  type Country,
  type Operator,
} from "../services/feeService";
import { callPixPayAirtime, getOperatorFlow, type PixPayCallParams } from "../lib/pixpay";
import { createNpPayment, getNpMinAmount } from "../lib/nowpayments";

const router = Router();

const DEFAULT_MARGIN = 0.015;

// ─── Local helpers (mirrored from transactions.ts) ────────────────────────────

const DIAL_CODES: Record<string, string> = {
  BJ: "229", BF: "226", CM: "237", CD: "243", CG: "242",
  CI: "225", GA: "241", GM: "220", GN: "224", ML: "223",
  SN: "221", TG: "228",
};

function normalizePhone(phone: string, country: string): string {
  const dialDigits = DIAL_CODES[country.toUpperCase()] ?? "";
  const digits = phone.replace(/\D/g, "");
  if (dialDigits && digits.startsWith(dialDigits)) {
    const local = digits.slice(dialDigits.length);
    return local.startsWith("0") ? local : "0" + local;
  }
  if (digits.startsWith("0")) return digits;
  return "0" + digits;
}

const COUNTRY_MIN_AMOUNTS: Partial<Record<string, number>> = {
  BJ: 500, BF: 500, CM: 500, CD: 500, CG: 500,
  CI: 200, GA: 500, GM: 200, GN: 1000, ML: 500,
  SN: 200, TG: 500,
};

async function getPixPayServiceId(
  operator: string, currency: string, type: "DEPOSIT" | "WITHDRAWAL", country: string
): Promise<number | null> {
  const r = await pool.query<{ service_id: number }>(
    `SELECT service_id FROM pixpay_services
     WHERE operator = $1 AND currency = $2 AND type = $3
       AND (country = $4 OR country IS NULL) AND active = true
     ORDER BY (country IS NOT NULL) DESC LIMIT 1`,
    [operator, currency, type, country]
  );
  if (!r.rows.length) return null;
  return r.rows[0].service_id;
}

async function getUserOperatorFeeRate(
  userId: number, country: string, operator: string, type: "DEPOSIT" | "WITHDRAWAL"
): Promise<{ total: number; pixpay: number; margin: number } | undefined> {
  try {
    const r = await pool.query<{
      pixpay_deposit: string; pixpay_withdrawal: string;
      margin_deposit: string; margin_withdrawal: string;
    }>(
      "SELECT pixpay_deposit, pixpay_withdrawal, margin_deposit, margin_withdrawal FROM user_operator_fees WHERE user_id = $1 AND country = $2 AND operator = $3",
      [userId, country, operator]
    );
    if (!r.rows.length) return undefined;
    const row = r.rows[0];
    const pixpay = type === "DEPOSIT" ? parseFloat(row.pixpay_deposit) : parseFloat(row.pixpay_withdrawal);
    const margin = type === "DEPOSIT" ? parseFloat(row.margin_deposit) : parseFloat(row.margin_withdrawal);
    return { total: pixpay + margin, pixpay, margin };
  } catch { return undefined; }
}

async function getUserFeeRate(
  userId: number, country: string, operator: string, type: "DEPOSIT"
): Promise<number | undefined> {
  try {
    const r = await pool.query<{ rate: string }>(
      "SELECT rate FROM user_fees WHERE user_id = $1 AND country = $2 AND operator = $3 AND transaction_type = $4",
      [userId, country, operator, type]
    );
    if (!r.rows.length) return undefined;
    return parseFloat(r.rows[0].rate);
  } catch { return undefined; }
}

// ─── Auth routes ──────────────────────────────────────────────────────────────

// POST /api/payment-links  — create a payment link
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  const schema = z.object({
    title:        z.string().min(1).max(200),
    description:  z.string().max(1000).optional(),
    photoData:    z.string().max(2_000_000).optional(), // base64 data URL
    priceType:    z.enum(["FIXED", "FREE"]),
    priceAmount:  z.number().positive().optional(),
    currency:     z.string().max(10).optional(),
    countries:    z.array(z.string().length(2)).min(1, "Sélectionnez au moins un pays"),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: parse.error.errors[0]?.message ?? "Paramètres invalides" });
    return;
  }

  const { title, description, photoData, priceType, priceAmount, currency, countries } = parse.data;

  if (priceType === "FIXED" && (!priceAmount || !currency)) {
    res.status(400).json({ error: "ValidationError", message: "Montant et devise requis pour un prix fixe" });
    return;
  }

  const token = crypto.randomBytes(5).toString("hex");

  try {
    const r = await pool.query<{
      id: number; token: string; title: string; description: string | null;
      photo_data: string | null; price_type: string; price_amount: string | null;
      currency: string | null; countries: string[]; is_active: boolean; created_at: Date;
    }>(
      `INSERT INTO payment_links (user_id, token, title, description, photo_data, price_type, price_amount, currency, countries)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.userId, token, title, description ?? null, photoData ?? null,
       priceType, priceAmount ?? null, currency ?? null, countries]
    );
    res.status(201).json(formatLink(r.rows[0]));
  } catch (err) {
    req.log.error({ err }, "Error creating payment link");
    res.status(500).json({ error: "InternalError", message: "Erreur lors de la création du lien" });
  }
});

// GET /api/payment-links  — list my links (with stats)
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const r = await pool.query(
      `SELECT pl.*,
         COUNT(t.id) FILTER (WHERE t.status != 'FAILED') AS transaction_count,
         COUNT(t.id) FILTER (WHERE t.status = 'FAILED') AS rejected_count,
         COALESCE(SUM(t.net_amount::numeric) FILTER (WHERE t.status IN ('COMPLETED','SUCCESS')), 0) AS total_collected
       FROM payment_links pl
       LEFT JOIN transactions t ON (t.metadata->>'paymentLinkId')::int = pl.id
       WHERE pl.user_id = $1
       GROUP BY pl.id
       ORDER BY pl.created_at DESC`,
      [req.userId]
    );
    res.json(r.rows.map(formatLink));
  } catch (err) {
    req.log.error({ err }, "Error listing payment links");
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

// GET /api/payment-links/:id/stats — detailed stats for one link
router.get("/:id/stats", authMiddleware, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  try {
    const r = await pool.query(
      `SELECT pl.click_count,
         COUNT(t.id) FILTER (WHERE t.status != 'FAILED') AS transaction_count,
         COUNT(t.id) FILTER (WHERE t.status = 'FAILED') AS rejected_count,
         COALESCE(SUM(t.net_amount::numeric) FILTER (WHERE t.status IN ('COMPLETED','SUCCESS')), 0) AS total_collected,
         pl.currency
       FROM payment_links pl
       LEFT JOIN transactions t ON (t.metadata->>'paymentLinkId')::int = pl.id
       WHERE pl.id = $1 AND pl.user_id = $2
       GROUP BY pl.id, pl.click_count, pl.currency`,
      [id, req.userId]
    );
    if (!r.rows.length) { res.status(404).json({ error: "NotFound" }); return; }
    const row = r.rows[0];
    res.json({
      clickCount:       parseInt(row.click_count) || 0,
      transactionCount: parseInt(row.transaction_count) || 0,
      rejectedCount:    parseInt(row.rejected_count) || 0,
      totalCollected:   parseFloat(row.total_collected) || 0,
      currency:         row.currency,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching link stats");
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

// PUT /api/payment-links/:id — update a link
router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const schema = z.object({
    title:        z.string().min(1).max(200),
    description:  z.string().max(1000).optional(),
    photoData:    z.string().max(2_000_000).optional().nullable(),
    priceType:    z.enum(["FIXED", "FREE"]),
    priceAmount:  z.number().positive().optional(),
    currency:     z.string().max(10).optional(),
    countries:    z.array(z.string().length(2)).min(1),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: parse.error.errors[0]?.message });
    return;
  }
  const { title, description, photoData, priceType, priceAmount, currency, countries } = parse.data;
  try {
    const r = await pool.query(
      `UPDATE payment_links
       SET title=$3, description=$4, photo_data=$5, price_type=$6, price_amount=$7, currency=$8,
           countries=$9, updated_at=NOW()
       WHERE id=$1 AND user_id=$2 RETURNING *`,
      [id, req.userId, title, description ?? null, photoData ?? null,
       priceType, priceAmount ?? null, currency ?? null, countries]
    );
    if (!r.rowCount) { res.status(404).json({ error: "NotFound" }); return; }
    res.json(formatLink(r.rows[0]));
  } catch (err) {
    req.log.error({ err }, "Error updating payment link");
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

// DELETE /api/payment-links/:id — delete a link
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  try {
    const r = await pool.query(
      "DELETE FROM payment_links WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, req.userId]
    );
    if (!r.rowCount) { res.status(404).json({ error: "NotFound" }); return; }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting payment link");
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

// ─── Public routes ────────────────────────────────────────────────────────────

// GET /api/pl/:token  — public: get link details for the payment page
router.get("/public/:token", async (req, res) => {
  const { token } = req.params;
  try {
    // Increment click counter (fire-and-forget)
    pool.query("UPDATE payment_links SET click_count = click_count + 1 WHERE token = $1", [token]).catch(() => {});

    const r = await pool.query(
      `SELECT id, token, title, description, photo_data, price_type, price_amount, currency, countries
       FROM payment_links WHERE token = $1 AND is_active = true`,
      [token]
    );
    if (!r.rows.length) {
      res.status(404).json({ error: "NotFound", message: "Lien de paiement introuvable ou expiré" });
      return;
    }
    const row = r.rows[0];
    res.json({
      token: row.token,
      title: row.title,
      description: row.description,
      photoData: row.photo_data,
      priceType: row.price_type,
      priceAmount: row.price_amount ? parseFloat(row.price_amount) : null,
      currency: row.currency,
      countries: row.countries,
    });
  } catch (err) {
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

// POST /api/pl/:token/pay  — public: client pays via a payment link
router.post("/public/:token/pay", async (req, res) => {
  const schema = z.object({
    amount:   z.number().min(1),
    country:  z.string().min(2),
    operator: z.string().min(2),
    phone:    z.string().min(6),
    feeBearer: z.enum(["SENDER", "RECIPIENT"]).default("SENDER"),
    omOtp:    z.string().optional(),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: parse.error.errors[0]?.message ?? "Paramètres invalides" });
    return;
  }

  const { token } = req.params;
  const { amount, country, operator, phone, feeBearer, omOtp } = parse.data;

  // Load the payment link + merchant user
  const linkRes = await pool.query<{
    id: number; user_id: number; price_type: string; price_amount: string | null;
    currency: string | null; countries: string[]; is_active: boolean;
  }>(
    "SELECT id, user_id, price_type, price_amount, currency, countries, is_active FROM payment_links WHERE token = $1",
    [token]
  );
  if (!linkRes.rows.length || !linkRes.rows[0].is_active) {
    res.status(404).json({ error: "NotFound", message: "Lien de paiement introuvable ou expiré" });
    return;
  }

  const link = linkRes.rows[0];
  const merchantId = link.user_id;

  // Validate country is in the allowed list
  if (link.countries.length > 0 && !link.countries.includes(country)) {
    res.status(400).json({ error: "CountryNotAllowed", message: "Ce pays n'est pas accepté pour ce lien de paiement" });
    return;
  }

  // If fixed price, enforce the amount
  if (link.price_type === "FIXED" && link.price_amount) {
    const fixedAmount = parseFloat(link.price_amount);
    if (Math.abs(amount - fixedAmount) > 1) {
      res.status(400).json({ error: "InvalidAmount", message: `Le montant doit être exactement ${fixedAmount}` });
      return;
    }
  }

  const currency = CURRENCY_MAP[country as Country];
  if (!currency) {
    res.status(400).json({ error: "InvalidCountry", message: "Pays non supporté" });
    return;
  }

  const LINK_MIN_AMOUNT = 50;
  if (amount < LINK_MIN_AMOUNT) {
    res.status(400).json({ error: "AmountTooLow", message: `Le montant minimum est de ${LINK_MIN_AMOUNT} ${currency}` });
    return;
  }

  const flow = getOperatorFlow(operator);
  if (flow === "OTP" && !omOtp) {
    res.status(400).json({ error: "OtpRequired", message: "Un code OTP Orange Money est requis. Composez #144*82# pour l'obtenir." });
    return;
  }

  const serviceId = await getPixPayServiceId(operator, currency, "DEPOSIT", country);
  if (serviceId === null) {
    res.status(503).json({ error: "ServiceNotAvailable", message: `Le paiement via ${operator} (${currency}) n'est pas disponible pour l'instant.` });
    return;
  }

  // Compute fee using merchant's fee configuration
  const opBreakdown = await getUserOperatorFeeRate(merchantId, country, operator, "DEPOSIT");
  const legacyRate = opBreakdown !== undefined ? undefined : await getUserFeeRate(merchantId, country, operator, "DEPOSIT");
  const userRate = opBreakdown?.total ?? legacyRate;
  const feeBreakdown = userRate !== undefined
    ? calculateFeeWithRate(amount, country as Country, operator as Operator, "DEPOSIT", userRate)
    : calculateFee(amount, country as Country, operator as Operator, "DEPOSIT");

  const feeAmt = feeBreakdown.feeAmount;
  const pixPayAmount    = feeBearer === "SENDER" ? amount + feeAmt : amount;
  const walletNetAmount = feeBearer === "SENDER" ? amount          : Math.max(amount - feeAmt, 0);

  const reference = generateReference();
  const yookpayMarginAmount = Math.round(amount * (opBreakdown?.margin ?? DEFAULT_MARGIN));

  try {
    // Create transaction in merchant's wallet
    const txRes = await pool.query<{ id: number; status: string; currency: string; amount: string }>(
      `INSERT INTO transactions (user_id, type, status, amount, fee, net_amount, currency, country, operator, phone, reference, fee_rate, yookpay_margin, metadata)
       VALUES ($1, 'DEPOSIT', 'PENDING', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, status, currency, amount`,
      [merchantId, amount.toString(), feeAmt.toString(), walletNetAmount.toString(),
       currency, country, operator, phone, reference,
       feeBreakdown.feeRate.toString(), yookpayMarginAmount.toString(),
       JSON.stringify({ initiatedAt: new Date().toISOString(), feeBearer, flow, pixPayAmount, paymentLinkId: link.id, paymentLinkToken: token })]
    );
    const tx = txRes.rows[0];

    const pixParams: PixPayCallParams = {
      currency,
      serviceId,
      amount: pixPayAmount,
      phone: normalizePhone(phone, country),
      customData: reference,
      omOtp,
    };

    const pixResult = await callPixPayAirtime(pixParams);
    const pixTxId = pixResult?.transaction_id ?? pixResult?.id ?? null;

    if (pixResult?.status === "FAILED" || pixResult?.error) {
      await pool.query("UPDATE transactions SET status = 'FAILED' WHERE id = $1", [tx.id]);
      res.status(400).json({ error: "PixPayError", message: pixResult?.message ?? "Transaction échouée côté opérateur" });
      return;
    }

    // Update transaction with PixPay ID
    if (pixTxId) {
      await pool.query("UPDATE transactions SET pix_transaction_id = $1 WHERE id = $2", [String(pixTxId), tx.id]);
    }

    // Return same shape as deposit
    // pending = true for all flows that require user action (OTP, STANDARD, WAVE)
    const finalStatus = pixResult?.status ?? "PENDING";
    const pending = finalStatus !== "SUCCESS" && finalStatus !== "FAILED";
    let smsLink: string | null = null;
    if (flow === "SMS" && pixResult?.sms_link) smsLink = pixResult.sms_link;
    if (flow === "SMS" && pixResult?.payment_url) smsLink = pixResult.payment_url;

    res.status(201).json({
      transaction: { id: tx.id, amount: parseFloat(tx.amount), currency: tx.currency, status: tx.status },
      flow,
      smsLink,
      pending,
      message: pending
        ? "Votre paiement est en cours de traitement. Veuillez approuver sur votre téléphone."
        : "Paiement initié avec succès.",
    });
  } catch (err: any) {
    res.status(500).json({ error: "InternalError", message: err?.message ?? "Erreur lors du paiement" });
  }
});

// POST /api/payment-links/public/fee-preview — public fee calculation (no auth)
router.post("/public/fee-preview", async (req, res) => {
  const schema = z.object({
    amount:   z.number().positive(),
    country:  z.string().min(2),
    operator: z.string().min(2),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "ValidationError" }); return; }
  const { amount, country, operator } = parse.data;
  try {
    const breakdown = calculateFee(amount, country as Country, operator as Operator, "DEPOSIT");
    res.json({
      grossAmount: amount,
      feeRate:     breakdown.feeRate,
      feeAmount:   breakdown.feeAmount,
      netAmount:   breakdown.netAmount,
      currency:    CURRENCY_MAP[country as Country] ?? "XOF",
    });
  } catch {
    res.status(400).json({ error: "CalculationError", message: "Impossible de calculer les frais" });
  }
});

// GET /api/payment-links/public/tx/:txId — public status polling for payment link transactions
router.get("/public/tx/:txId", async (req, res) => {
  const txId = parseInt(req.params.txId);
  if (isNaN(txId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  try {
    const r = await pool.query<{ status: string; amount: string; currency: string }>(
      `SELECT status, amount, currency FROM transactions WHERE id = $1
       AND metadata->>'paymentLinkId' IS NOT NULL`,
      [txId]
    );
    if (!r.rows.length) { res.status(404).json({ error: "NotFound" }); return; }
    const row = r.rows[0];
    res.json({ status: row.status, amount: parseFloat(row.amount), currency: row.currency });
  } catch (err) {
    res.status(500).json({ error: "InternalError" });
  }
});

// POST /api/payment-links/public/:token/pay-crypto — public: USDT payment via NowPayments
router.post("/public/:token/pay-crypto", async (req, res) => {
  const schema = z.object({ amountUsdt: z.number().min(1) });
  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: "Montant USDT invalide" });
    return;
  }
  const { token } = req.params;
  const { amountUsdt } = parse.data;

  // Load the payment link
  const linkRes = await pool.query<{ id: number; user_id: number; is_active: boolean }>(
    "SELECT id, user_id, is_active FROM payment_links WHERE token = $1",
    [token]
  );
  if (!linkRes.rows.length || !linkRes.rows[0].is_active) {
    res.status(404).json({ error: "NotFound", message: "Lien de paiement introuvable ou expiré" });
    return;
  }
  const link = linkRes.rows[0];
  const merchantId = link.user_id;

  // Validate minimum (NowPayments or fallback)
  let minUsdt = 20;
  try { const m = await getNpMinAmount("usdttrc20", "usdttrc20"); minUsdt = Math.ceil(m); } catch { /* fallback 20 */ }
  if (amountUsdt < minUsdt) {
    res.status(400).json({ error: "BelowMinimum", message: `Montant minimum : ${minUsdt} USDT` });
    return;
  }

  const reference = generateReference();
  const callbackUrl = `${process.env.APP_URL ?? ""}/api/nowpayments/ipn`;

  try {
    // Create pending transaction in merchant's wallet
    const txRes = await pool.query<{ id: number }>(
      `INSERT INTO transactions (user_id, type, status, amount, fee, net_amount, currency, country, operator, phone, reference, fee_rate, yookpay_margin, metadata)
       VALUES ($1,'DEPOSIT','PENDING',$2,'0',$3,'USDT','ZZ','CRYPTO','',$4,'0','0',$5) RETURNING id`,
      [merchantId, amountUsdt.toString(), amountUsdt.toFixed(8), reference,
       JSON.stringify({ provider: "NOWPAYMENTS", paymentLinkId: link.id, paymentLinkToken: token, initiatedAt: new Date().toISOString() })]
    );
    const txId = txRes.rows[0].id;

    // Create NowPayments payment address
    const npResult = await createNpPayment({
      priceAmount: amountUsdt,
      priceCurrency: "usd",
      payCurrency: "usdttrc20",
      orderId: reference,
      orderDescription: `YookLink USDT payment - link ${link.id}`,
      ipnCallbackUrl: callbackUrl,
    });

    // Store NowPayments details in metadata
    await pool.query(
      `UPDATE transactions SET metadata = $1 WHERE id = $2`,
      [JSON.stringify({
        provider: "NOWPAYMENTS",
        paymentLinkId: link.id, paymentLinkToken: token,
        nowpaymentsPaymentId: npResult.payment_id,
        payAddress: npResult.pay_address,
        payCurrency: "usdttrc20",
        payAmount: npResult.pay_amount,
        initiatedAt: new Date().toISOString(),
      }), txId]
    );

    res.status(201).json({
      txId,
      payAddress: npResult.pay_address,
      payAmount: npResult.pay_amount,
      payCurrency: "USDTTRC20",
      network: "TRC-20 (Tron)",
      npPaymentId: npResult.payment_id,
      message: "Envoyez exactement le montant USDT indiqué à l'adresse ci-dessous. La transaction sera confirmée sous 10-20 minutes.",
    });
  } catch (err: any) {
    const raw = err?.message ?? "Erreur NowPayments";
    const detail = raw.replace(/^NowPayments API error \d+:\s*/i, "");
    res.status(400).json({ error: "NowPaymentsError", message: detail });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLink(row: any) {
  return {
    id:               row.id,
    token:            row.token,
    title:            row.title,
    description:      row.description,
    photoData:        row.photo_data,
    priceType:        row.price_type,
    priceAmount:      row.price_amount ? parseFloat(row.price_amount) : null,
    currency:         row.currency,
    countries:        row.countries ?? [],
    isActive:         row.is_active,
    clickCount:       parseInt(row.click_count) || 0,
    transactionCount: parseInt(row.transaction_count) || 0,
    rejectedCount:    parseInt(row.rejected_count) || 0,
    totalCollected:   parseFloat(row.total_collected) || 0,
    createdAt:        row.created_at,
  };
}

export default router;
