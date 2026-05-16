import { Router } from "express";
import { authMiddleware, type AuthRequest } from "../middlewares/authMiddleware";
import { FEE_TABLE, CURRENCY_MAP } from "../services/feeService";
import { getDefaultMargin } from "../lib/marginCache";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

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

export default router;
