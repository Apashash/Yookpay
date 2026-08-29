import { Router } from "express";
import { authMiddleware, type AuthRequest } from "../middlewares/authMiddleware";
import { FEE_TABLE, CURRENCY_MAP } from "../services/feeService";
import { getDefaultMargin } from "../lib/marginCache";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { createQuote, getServiceList } from "../lib/maviance";
import { z } from "zod";

const router = Router();

// GET /services/maviance — configured Maviance countries, operators and services.
// This is the local catalogue. Fees are not included because Maviance calculates
// them dynamically for each amount; use /maviance/quote for the exact fee.
router.get("/maviance", async (_req, res) => {
  try {
    const result = await db.execute<{
      country: string | null;
      currency: string;
      operator: string;
      type: string;
      service_id: number;
      active: boolean;
      notes: string | null;
    }>(sql`
      SELECT country, currency, operator, type, service_id, active, notes
      FROM maviance_services
      WHERE active = true
      ORDER BY country, currency, operator, type
    `);

    const countries: Record<string, {
      currency: string;
      operators: Record<string, {
        deposit?: { serviceId: number; notes: string | null };
        withdrawal?: { serviceId: number; notes: string | null };
        card?: { serviceId: number; notes: string | null };
      }>;
    }> = {};

    for (const row of result.rows) {
      const country = row.country?.toUpperCase();
      if (!country) continue;
      const operator = row.operator.toUpperCase();
      countries[country] ??= { currency: row.currency.toUpperCase(), operators: {} };
      countries[country].operators[operator] ??= {};
      const service = {
        serviceId: Number(row.service_id),
        notes: row.notes,
      };
      if (row.type === "DEPOSIT") countries[country].operators[operator].deposit = service;
      if (row.type === "WITHDRAWAL") countries[country].operators[operator].withdrawal = service;
      if (row.type === "CARD") countries[country].operators[operator].card = service;
    }

    res.json({
      provider: "MAVIANCE",
      source: "configured_services",
      fees: {
        mode: "dynamic_quote",
        quoteEndpoint: "/api/services/maviance/quote",
        message: "Les frais Maviance sont retournés par le devis selon le montant, le service et la devise.",
      },
      countries,
    });
  } catch (err) {
    _req.log?.error({ err }, "Get Maviance catalogue error");
    res.status(500).json({ error: "InternalError", message: "Impossible de charger le catalogue Maviance" });
  }
});

// GET /services/maviance/live — services currently exposed by the Maviance API.
// Requires Maviance credentials and calls the provider at request time.
router.get("/maviance/live", async (req, res) => {
  const type = typeof req.query.type === "string" ? req.query.type.toUpperCase() : undefined;
  if (type && !["CASHIN", "CASHOUT", "CARD", "TOPUP", "PRODUCT", "SUBSCRIPTION", "SEARCHABLE_BILL"].includes(type)) {
    res.status(400).json({ error: "ValidationError", message: "Type de service Maviance invalide" });
    return;
  }
  try {
    const services = await getServiceList(type);
    res.json({ provider: "MAVIANCE", source: "live_api", type: type ?? null, services });
  } catch (err) {
    req.log.error({ err, type }, "Get live Maviance services error");
    const message = err instanceof Error ? err.message : "Maviance service list unavailable";
    res.status(502).json({ error: "ProviderError", message });
  }
});

// POST /services/maviance/quote — exact Maviance provider fee for a transaction.
// The amount is the amount sent to Maviance, before YookPay's own margin.
router.post("/maviance/quote", async (req, res) => {
  const schema = z.object({
    serviceId: z.number().int().positive(),
    amount: z.number().positive(),
    currency: z.enum(["XAF", "XOF", "CDF"]),
    operation: z.enum(["DEPOSIT", "WITHDRAWAL"]).default("DEPOSIT"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "ValidationError",
      message: "serviceId, amount et currency (XAF/XOF/CDF) sont requis",
    });
    return;
  }

  try {
    const quote = await createQuote(
      parsed.data.serviceId,
      parsed.data.amount,
      parsed.data.currency,
      parsed.data.operation === "WITHDRAWAL" ? "CASHIN" : "CASHOUT",
    );
    res.json({
      provider: "MAVIANCE",
      serviceId: parsed.data.serviceId,
      requestedAmount: parsed.data.amount,
      currency: parsed.data.currency,
      operation: parsed.data.operation,
      quoteId: quote.quoteId,
      payToken: quote.quoteId,
      providerFee: Number(quote.fees ?? 0),
      providerAmount: Number(quote.amount ?? parsed.data.amount),
      expiresAt: quote.expiry ?? null,
      quote,
    });
  } catch (err) {
    req.log.error({ err, body: parsed.data }, "Maviance quote error");
    const message = err instanceof Error ? err.message : "Maviance quote unavailable";
    res.status(502).json({ error: "ProviderError", message });
  }
});

// GET /services/fees — fee table for the authenticated user
// Shows total rate = pixpay_base + yookpay_margin (as configured by admin)
router.get("/fees", authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Load per-user operator fee overrides from admin-managed table
    const overrideRows = await db.execute<{
      country: string;
      operator: string;
      pixpay_deposit: string;
      pixpay_withdrawal: string;
      margin_deposit: string;
      margin_withdrawal: string;
    }>(sql`
      SELECT country, operator, pixpay_deposit, pixpay_withdrawal, margin_deposit, margin_withdrawal
      FROM user_operator_fees
      WHERE user_id = ${req.userId!}
    `);

    // Build lookup: "COUNTRY:OPERATOR" → { pixpayD, pixpayW, marginD, marginW }
    const overrideMap: Record<string, {
      pixpayD: number; pixpayW: number; marginD: number; marginW: number;
    }> = {};
    for (const r of overrideRows.rows) {
      overrideMap[`${r.country}:${r.operator}`] = {
        pixpayD:  parseFloat(r.pixpay_deposit),
        pixpayW:  parseFloat(r.pixpay_withdrawal),
        marginD:  parseFloat(r.margin_deposit),
        marginW:  parseFloat(r.margin_withdrawal),
      };
    }

    const hasCustomFees = Object.keys(overrideMap).length > 0;

    const result: Record<string, {
      currency: string;
      operators: Array<{
        name: string;
        deposit:    { rate: number; pixpay: number; margin: number; minFee: number; maxFee: number | null; isCustom: boolean };
        withdrawal: { rate: number; pixpay: number; margin: number; minFee: number; maxFee: number | null; isCustom: boolean };
        transfer:   { rate: number; pixpay: number; margin: number; minFee: number; maxFee: number | null; isCustom: boolean };
      }>;
    }> = {};

    const defMargin = await getDefaultMargin();

    for (const [country, table] of Object.entries(FEE_TABLE)) {
      const operators = [];
      for (const [operator, config] of Object.entries(table)) {
        const override = overrideMap[`${country}:${operator}`];
        const isCustom = !!override;

        const pixpayD  = override ? override.pixpayD  : config.DEPOSIT.rate;
        const pixpayW  = override ? override.pixpayW  : config.WITHDRAWAL.rate;
        const pixpayT  = config.TRANSFER.rate;
        const marginD  = override ? override.marginD  : defMargin;
        const marginW  = override ? override.marginW  : defMargin;
        const marginT  = override ? override.marginD  : defMargin;

        operators.push({
          name: operator,
          deposit: {
            rate:    pixpayD + marginD,
            pixpay:  pixpayD,
            margin:  marginD,
            minFee:  config.DEPOSIT.minFee,
            maxFee:  config.DEPOSIT.maxFee,
            isCustom,
          },
          withdrawal: {
            rate:    pixpayW + marginW,
            pixpay:  pixpayW,
            margin:  marginW,
            minFee:  config.WITHDRAWAL.minFee,
            maxFee:  config.WITHDRAWAL.maxFee,
            isCustom,
          },
          transfer: {
            rate:    pixpayT + marginT,
            pixpay:  pixpayT,
            margin:  marginT,
            minFee:  config.TRANSFER.minFee,
            maxFee:  config.TRANSFER.maxFee,
            isCustom,
          },
        });
      }
      result[country] = {
        currency: CURRENCY_MAP[country as keyof typeof CURRENCY_MAP],
        operators,
      };
    }

    res.json({ fees: result, hasCustomFees });
  } catch (err) {
    req.log.error({ err }, "Get services fees error");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch fees" });
  }
});

// GET /services/available-operators — active operators per country (union of PixPay + Maviance)
router.get("/available-operators", async (_req, res) => {
  try {
    // Merge services from all configured providers; operator appears once.
    const [pixResult, mavResult, pawaResult] = await Promise.all([
      db.execute<{ operator: string; country: string; type: string }>(
        sql`SELECT operator, country, type FROM pixpay_services WHERE active = true`
      ),
      db.execute<{ operator: string; country: string; type: string }>(
        sql`SELECT operator, country, type FROM maviance_services WHERE active = true`
      ).catch(() => ({ rows: [] as Array<{ operator: string; country: string; type: string }> })),
      db.execute<{ operator: string; country: string; type: string }>(
        sql`SELECT operator, country, type FROM pawapay_services WHERE active = true`
      ).catch(() => ({ rows: [] as Array<{ operator: string; country: string; type: string }> })),
    ]);

    const map: Record<string, { deposit: string[]; withdrawal: string[]; providers: Record<string, string[]> }> = {};

    const addRow = (row: { operator: string; country: string | null; type: string }, source: string) => {
      const country  = row.country?.toUpperCase();
      const operator = row.operator?.toUpperCase();
      const type     = row.type?.toUpperCase();
      if (!country || !operator || !type) return;
      if (operator === "CARD") return; // Card shown separately
      if (!map[country]) map[country] = { deposit: [], withdrawal: [], providers: {} };
      if (type === "DEPOSIT"    && !map[country].deposit.includes(operator))    map[country].deposit.push(operator);
      if (type === "WITHDRAWAL" && !map[country].withdrawal.includes(operator)) map[country].withdrawal.push(operator);
      // Track which providers support each operator
      const pKey = `${operator}:${type}`;
      if (!map[country].providers[pKey]) map[country].providers[pKey] = [];
      if (!map[country].providers[pKey].includes(source)) map[country].providers[pKey].push(source);
    };

    for (const row of pixResult.rows as Array<{ operator: string; country: string | null; type: string }>) {
      addRow(row, "PIXPAY");
    }
    for (const row of mavResult.rows as Array<{ operator: string; country: string | null; type: string }>) {
      addRow(row, "MAVIANCE");
    }
    for (const row of pawaResult.rows as Array<{ operator: string; country: string | null; type: string }>) {
      addRow(row, "PAWAPAY");
    }

    res.json({ available: map });
  } catch {
    res.json({ available: {} });
  }
});

// GET /services/card-available — countries/currencies that support card payment via e-nkap
router.get("/card-available", async (_req, res) => {
  try {
    const result = await db.execute<{ country: string; currency: string }>(
      sql`SELECT DISTINCT country, currency FROM maviance_services WHERE type = 'CARD' AND active = true`
    ).catch(() => ({ rows: [] as Array<{ country: string; currency: string }> }));
    res.json({ available: result.rows });
  } catch {
    res.json({ available: [] });
  }
});

export default router;
