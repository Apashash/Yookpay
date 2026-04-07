import { Router } from "express";
import { db } from "@workspace/db";
import { userFeesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/authMiddleware";
import { FEE_TABLE, CURRENCY_MAP } from "../services/feeService";

const router = Router();

const GLOBAL_COUNTRY = "ZZ";
const GLOBAL_OPERATOR = "GLOBAL";

// GET /services/fees — fee table for the authenticated user (with user-specific overrides)
router.get("/fees", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const allOverrides = await db
      .select()
      .from(userFeesTable)
      .where(eq(userFeesTable.userId, req.userId!));

    // Separate global overrides (ZZ/GLOBAL) from country/operator specific ones
    const globalMap: Record<string, number> = {};
    const specificMap: Record<string, { rate: number; minFee: number; maxFee: number | null }> = {};

    for (const o of allOverrides) {
      if (o.country === GLOBAL_COUNTRY && o.operator === GLOBAL_OPERATOR) {
        globalMap[o.transactionType] = parseFloat(o.rate);
      } else {
        const key = `${o.country}:${o.operator}:${o.transactionType}`;
        specificMap[key] = {
          rate: parseFloat(o.rate),
          minFee: o.minFee,
          maxFee: o.maxFee ?? null,
        };
      }
    }

    const hasCustomFees = Object.keys(globalMap).length > 0 || Object.keys(specificMap).length > 0;

    const result: Record<string, {
      currency: string;
      operators: Array<{
        name: string;
        deposit:    { rate: number; minFee: number; maxFee: number | null; isCustom: boolean };
        withdrawal: { rate: number; minFee: number; maxFee: number | null; isCustom: boolean };
        transfer:   { rate: number; minFee: number; maxFee: number | null; isCustom: boolean };
      }>;
    }> = {};

    for (const [country, table] of Object.entries(FEE_TABLE)) {
      const operators = [];
      for (const [operator, config] of Object.entries(table)) {
        const resolve = (type: "DEPOSIT" | "WITHDRAWAL" | "TRANSFER") => {
          const base = config[type];

          // 1. Specific country+operator override takes priority
          const specificKey = `${country}:${operator}:${type}`;
          if (specificMap[specificKey]) {
            return { ...specificMap[specificKey], isCustom: true };
          }

          // 2. Global override (all operators, all countries)
          if (globalMap[type] !== undefined) {
            return { rate: globalMap[type], minFee: base.minFee, maxFee: base.maxFee, isCustom: true };
          }

          // 3. Default from FEE_TABLE
          return { rate: base.rate, minFee: base.minFee, maxFee: base.maxFee, isCustom: false };
        };

        operators.push({
          name: operator,
          deposit:    resolve("DEPOSIT"),
          withdrawal: resolve("WITHDRAWAL"),
          transfer:   resolve("TRANSFER"),
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
