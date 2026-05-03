import { Router } from "express";
import { db } from "@workspace/db";
import { walletsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/authMiddleware";

const router = Router();

router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const wallets = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, req.userId!));

    res.json(
      wallets.map((w) => ({
        id: w.id,
        userId: w.userId,
        currency: w.currency,
        balance: parseFloat(w.balance),
        country: w.country,
        updatedAt: w.updatedAt,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Get wallets error");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch wallets" });
  }
});

export default router;
