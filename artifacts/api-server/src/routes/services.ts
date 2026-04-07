import { Router } from "express";
import { db } from "@workspace/db";
import { userFeesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/authMiddleware";
import { FEE_TABLE, CURRENCY_MAP } from "../services/feeService";

const router = Router();

// GET /services/fees — fee table for the authenticated user (with user-specific overrides)
router.get("/fees", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const overrides = await db
      .select()
      .from(userFeesTable)
      .where(eq(userFeesTable.userId, req.userId!));

    const overrideMap: Record<string, { rate: number; minFee: number; maxFee: number | null }> = {};
    for (const o of overrides) {
      const key = `${o.country}:${o.operator}:${o.transactionType}`;
      overrideMap[key] = {
        rate: parseFloat(o.rate),
        minFee: o.minFee,
        maxFee: o.maxFee ?? null,
      };
    }

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
          const key = `${country}:${operator}:${type}`;
          const base = config[type];
          if (overrideMap[key]) {
            return { ...overrideMap[key], isCustom: true };
          }
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

    res.json({ fees: result, hasCustomFees: overrides.length > 0 });
  } catch (err) {
    req.log.error({ err }, "Get services fees error");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch fees" });
  }
});

export default router;
