import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, walletsTable } from "@workspace/db/schema";
import { eq, and, desc, sql, gte, count, sum } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/authMiddleware";

const router = Router();

router.get("/summary", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  try {
    const [wallets, statsRows, recentTxs] = await Promise.all([
      db.select().from(walletsTable).where(eq(walletsTable.userId, userId)),
      db
        .select({
          type: transactionsTable.type,
          status: transactionsTable.status,
          totalAmount: sum(transactionsTable.amount),
          totalFees: sum(transactionsTable.fee),
          txCount: count(),
        })
        .from(transactionsTable)
        .where(eq(transactionsTable.userId, userId))
        .groupBy(transactionsTable.type, transactionsTable.status),
      db
        .select()
        .from(transactionsTable)
        .where(eq(transactionsTable.userId, userId))
        .orderBy(desc(transactionsTable.createdAt))
        .limit(5),
    ]);

    let totalDeposited = 0;
    let totalWithdrawn = 0;
    let totalFeesPaid = 0;
    let totalCount = 0;
    let successCount = 0;

    for (const row of statsRows) {
      const amount = parseFloat(row.totalAmount ?? "0");
      const fees = parseFloat(row.totalFees ?? "0");
      const cnt = row.txCount;
      totalCount += cnt;
      totalFeesPaid += fees;
      if (row.status === "SUCCESS") successCount += cnt;
      if (row.type === "DEPOSIT" && row.status === "SUCCESS") totalDeposited += amount;
      if (row.type === "WITHDRAWAL" && row.status === "SUCCESS") totalWithdrawn += amount;
    }

    res.json({
      totalDeposited,
      totalWithdrawn,
      totalFeesPaid,
      transactionCount: totalCount,
      successRate: totalCount > 0 ? Math.round((successCount / totalCount) * 100) / 100 : 0,
      wallets: wallets.map((w) => ({
        id: w.id,
        userId: w.userId,
        currency: w.currency,
        balance: parseFloat(w.balance),
        country: w.country,
        updatedAt: w.updatedAt,
      })),
      recentTransactions: recentTxs.map((t) => ({
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
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Dashboard summary error");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch summary" });
  }
});

router.get("/recent-activity", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    const txs = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.userId, userId))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(10);

    res.json(
      txs.map((t) => ({
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
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Recent activity error");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch recent activity" });
  }
});

router.get("/volume-chart", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const rows = await db
      .select({
        date: sql<string>`DATE(${transactionsTable.createdAt})`.as("date"),
        type: transactionsTable.type,
        total: sum(transactionsTable.amount),
      })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId),
          eq(transactionsTable.status, "SUCCESS"),
          gte(transactionsTable.createdAt, sevenDaysAgo)
        )
      )
      .groupBy(sql`DATE(${transactionsTable.createdAt})`, transactionsTable.type)
      .orderBy(sql`DATE(${transactionsTable.createdAt})`);

    // Build 7-day map
    const dateMap: Record<string, { deposits: number; withdrawals: number; transfers: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      dateMap[key] = { deposits: 0, withdrawals: 0, transfers: 0 };
    }

    for (const row of rows) {
      const key = row.date;
      if (!dateMap[key]) dateMap[key] = { deposits: 0, withdrawals: 0, transfers: 0 };
      const amount = parseFloat(row.total ?? "0");
      if (row.type === "DEPOSIT") dateMap[key].deposits += amount;
      else if (row.type === "WITHDRAWAL") dateMap[key].withdrawals += amount;
      else if (row.type === "TRANSFER") dateMap[key].transfers += amount;
    }

    const result = Object.entries(dateMap).map(([date, values]) => ({ date, ...values }));
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Volume chart error");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch volume data" });
  }
});

export default router;
