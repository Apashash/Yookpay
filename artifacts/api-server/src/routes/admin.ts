import { Router } from "express";
import { db, pool } from "@workspace/db";
import { usersTable, walletsTable, transactionsTable, kycDocumentsTable, userFeesTable } from "@workspace/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/authMiddleware";
import { adminMiddleware } from "../middlewares/adminMiddleware";
import { z } from "zod";
import { FEE_TABLE, CURRENCY_MAP } from "../services/feeService";
import { getAllUsdtRates, setUsdtRate, USDT_PAIRS, getEffectiveRate, getExchangeFeeRate } from "../lib/adminRates";

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

// Default rates (must mirror feeService.ts)
const DEFAULT_RATES: Record<string, number> = {
  DEPOSIT: 0.018,
  WITHDRAWAL: 0.023,
  TRANSFER: 0.019,
};
const GLOBAL_COUNTRY = "ZZ";
const GLOBAL_OPERATOR = "GLOBAL";

// GET /admin/stats — dashboard stats
router.get("/stats", async (req: AuthRequest, res) => {
  try {
    const [
      [{ totalUsers }],
      [{ pendingKyc }],
      [{ totalTx }],
      [{ customFees }],
      [{ totalVolume, totalMargin, totalFees, depositMargin, withdrawalMargin, successTx }],
      [{ verifiedUsers }],
      kycProfileStats,
      txByCurrency,
    ] = await Promise.all([
      db.select({ totalUsers: sql<number>`count(*)::int` }).from(usersTable),
      db.select({ pendingKyc: sql<number>`count(*)::int` }).from(kycDocumentsTable).where(eq(kycDocumentsTable.status, "PENDING")),
      db.select({ totalTx: sql<number>`count(*)::int` }).from(transactionsTable),
      db.select({ customFees: sql<number>`count(distinct user_id)::int` }).from(userFeesTable),
      db.select({
        totalVolume:      sql<string>`coalesce(sum(amount::numeric), 0)`,
        totalMargin:      sql<string>`coalesce(sum(yookpay_margin::numeric), 0)`,
        totalFees:        sql<string>`coalesce(sum(fee::numeric), 0)`,
        depositMargin:    sql<string>`coalesce(sum(CASE WHEN type='DEPOSIT'    THEN yookpay_margin::numeric ELSE 0 END), 0)`,
        withdrawalMargin: sql<string>`coalesce(sum(CASE WHEN type='WITHDRAWAL' THEN yookpay_margin::numeric ELSE 0 END), 0)`,
        successTx:        sql<number>`count(*)::int`,
      }).from(transactionsTable).where(eq(transactionsTable.status, "SUCCESS")),
      db.select({ verifiedUsers: sql<number>`count(distinct user_id)::int` }).from(kycDocumentsTable).where(eq(kycDocumentsTable.status, "VERIFIED")),
      db.execute<{ pending_kyc: number; pending_kyb: number; verified_kyc: number; verified_kyb: number }>(sql`
        SELECT
          count(*) FILTER (WHERE kyc_status = 'PENDING')::int                               AS pending_kyc,
          count(*) FILTER (WHERE kyb_status = 'PENDING')::int                               AS pending_kyb,
          count(*) FILTER (WHERE kyc_status IN ('VERIFIED','APPROVED'))::int                AS verified_kyc,
          count(*) FILTER (WHERE kyb_status IN ('VERIFIED','APPROVED'))::int                AS verified_kyb
        FROM kyc_profiles
      `),
      db.select({
        currency:         transactionsTable.currency,
        volume:           sql<string>`coalesce(sum(amount::numeric), 0)`,
        margin:           sql<string>`coalesce(sum(yookpay_margin::numeric), 0)`,
        fees:             sql<string>`coalesce(sum(fee::numeric), 0)`,
        depositMargin:    sql<string>`coalesce(sum(CASE WHEN type='DEPOSIT'    THEN yookpay_margin::numeric ELSE 0 END), 0)`,
        withdrawalMargin: sql<string>`coalesce(sum(CASE WHEN type='WITHDRAWAL' THEN yookpay_margin::numeric ELSE 0 END), 0)`,
        count:            sql<number>`count(*)::int`,
      }).from(transactionsTable).where(eq(transactionsTable.status, "SUCCESS")).groupBy(transactionsTable.currency),
    ]);

    const kp = kycProfileStats.rows[0] ?? { pending_kyc: 0, pending_kyb: 0, verified_kyc: 0, verified_kyb: 0 };

    res.json({
      totalUsers,
      pendingKyc,
      totalTx,
      customFees,
      successTx,
      totalVolume: parseFloat(totalVolume),
      totalMargin: parseFloat(totalMargin),
      totalFees: parseFloat(totalFees),
      depositMargin: parseFloat(depositMargin),
      withdrawalMargin: parseFloat(withdrawalMargin),
      verifiedUsers,
      pendingKycProfiles:  Number(kp.pending_kyc),
      pendingKybProfiles:  Number(kp.pending_kyb),
      verifiedKycProfiles: Number(kp.verified_kyc),
      verifiedKybProfiles: Number(kp.verified_kyb),
      byCurrency: txByCurrency.map((r) => ({
        currency: r.currency,
        volume: parseFloat(r.volume),
        margin: parseFloat(r.margin),
        fees: parseFloat(r.fees),
        depositMargin: parseFloat(r.depositMargin),
        withdrawalMargin: parseFloat(r.withdrawalMargin),
        count: r.count,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Admin stats error");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch stats" });
  }
});

// GET /admin/users — list all users with wallet balances and effective rates
router.get("/users", async (req: AuthRequest, res) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        phone: usersTable.phone,
        country: usersTable.country,
        role: usersTable.role,
        status: sql<string>`coalesce(users.status, 'ACTIVE')`,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt));

    const wallets = await db.select().from(walletsTable);
    const walletMap: Record<number, typeof wallets> = {};
    for (const w of wallets) {
      if (!walletMap[w.userId]) walletMap[w.userId] = [];
      walletMap[w.userId].push(w);
    }

    const kycCounts = await db
      .select({ userId: kycDocumentsTable.userId, status: kycDocumentsTable.status, count: sql<number>`count(*)::int` })
      .from(kycDocumentsTable)
      .groupBy(kycDocumentsTable.userId, kycDocumentsTable.status);
    const kycMap: Record<number, Record<string, number>> = {};
    for (const k of kycCounts) {
      if (!kycMap[k.userId]) kycMap[k.userId] = {};
      kycMap[k.userId][k.status] = k.count;
    }

    // Fetch all global fee overrides
    const globalFees = await db
      .select()
      .from(userFeesTable)
      .where(and(eq(userFeesTable.country, GLOBAL_COUNTRY), eq(userFeesTable.operator, GLOBAL_OPERATOR)));
    const feeMap: Record<number, Record<string, number>> = {};
    for (const f of globalFees) {
      if (!feeMap[f.userId]) feeMap[f.userId] = {};
      feeMap[f.userId][f.transactionType] = parseFloat(f.rate);
    }

    res.json({
      users: users.map((u) => {
        const userFees = feeMap[u.id] ?? {};
        return {
          ...u,
          wallets: walletMap[u.id] ?? [],
          kycStatus:
            (kycMap[u.id]?.PENDING ?? 0) > 0 ? "PENDING" :
            (kycMap[u.id]?.VERIFIED ?? 0) > 0 ? "PARTIAL" :
            "NONE",
          effectiveRates: {
            DEPOSIT: userFees.DEPOSIT ?? DEFAULT_RATES.DEPOSIT,
            WITHDRAWAL: userFees.WITHDRAWAL ?? DEFAULT_RATES.WITHDRAWAL,
            TRANSFER: userFees.TRANSFER ?? DEFAULT_RATES.TRANSFER,
          },
          hasCustomFees: Object.keys(userFees).length > 0,
        };
      }),
    });
  } catch (err) {
    req.log.error({ err }, "Admin list users error");
    res.status(500).json({ error: "InternalError", message: "Failed to list users" });
  }
});

// GET /admin/users/:id — user detail with fee overrides and KYC docs
router.get("/users/:id", async (req: AuthRequest, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) {
    res.status(400).json({ error: "ValidationError", message: "Invalid user ID" });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "NotFound", message: "Utilisateur introuvable" });
      return;
    }

    const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
    const fees = await db.select().from(userFeesTable).where(eq(userFeesTable.userId, userId));
    const kycDocs = await db
      .select({ id: kycDocumentsTable.id, type: kycDocumentsTable.type, status: kycDocumentsTable.status, fileName: kycDocumentsTable.fileName, notes: kycDocumentsTable.notes, createdAt: kycDocumentsTable.createdAt, updatedAt: kycDocumentsTable.updatedAt })
      .from(kycDocumentsTable)
      .where(eq(kycDocumentsTable.userId, userId));
    const recentTx = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.userId, userId))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(10);

    // Build override maps
    const globalFees = fees.filter((f) => f.country === GLOBAL_COUNTRY && f.operator === GLOBAL_OPERATOR);
    const specificFees = fees.filter((f) => !(f.country === GLOBAL_COUNTRY && f.operator === GLOBAL_OPERATOR));

    // Global rate per transaction type
    const globalRateMap: Record<string, { rate: number; feeId: number }> = {};
    for (const f of globalFees) {
      globalRateMap[f.transactionType] = { rate: parseFloat(f.rate), feeId: f.id };
    }

    // Specific override map: "country:operator:type" → override
    const specificMap: Record<string, { rate: number; minFee: number; maxFee: number | null; feeId: number }> = {};
    for (const f of specificFees) {
      specificMap[`${f.country}:${f.operator}:${f.transactionType}`] = {
        rate: parseFloat(f.rate),
        minFee: f.minFee,
        maxFee: f.maxFee ?? null,
        feeId: f.id,
      };
    }

    // Effective global rates (3 types) for quick display
    const effectiveRates = (["DEPOSIT", "WITHDRAWAL", "TRANSFER"] as const).map((type) => {
      const g = globalRateMap[type];
      return {
        transactionType: type,
        rate: g ? g.rate : DEFAULT_RATES[type],
        isCustom: !!g,
        feeId: g?.feeId ?? null,
      };
    });

    // Full fee table: all countries × operators with effective rates
    const fullFeeTable: Record<string, {
      currency: string;
      operators: Array<{
        name: string;
        deposit:    { rate: number; isCustom: boolean; source: string; feeId: number | null };
        withdrawal: { rate: number; isCustom: boolean; source: string; feeId: number | null };
        transfer:   { rate: number; isCustom: boolean; source: string; feeId: number | null };
      }>;
    }> = {};

    for (const [country, table] of Object.entries(FEE_TABLE)) {
      const operators = [];
      for (const [operator] of Object.entries(table)) {
        const resolve = (type: "DEPOSIT" | "WITHDRAWAL" | "TRANSFER") => {
          const specificKey = `${country}:${operator}:${type}`;
          if (specificMap[specificKey]) {
            return { rate: specificMap[specificKey].rate, isCustom: true, source: "specific", feeId: specificMap[specificKey].feeId };
          }
          if (globalRateMap[type]) {
            return { rate: globalRateMap[type].rate, isCustom: true, source: "global", feeId: null };
          }
          return { rate: DEFAULT_RATES[type], isCustom: false, source: "default", feeId: null };
        };
        operators.push({
          name: operator,
          deposit:    resolve("DEPOSIT"),
          withdrawal: resolve("WITHDRAWAL"),
          transfer:   resolve("TRANSFER"),
        });
      }
      fullFeeTable[country] = {
        currency: CURRENCY_MAP[country as keyof typeof CURRENCY_MAP],
        operators,
      };
    }

    // Fetch KYC profile status
    const kycProfile = await db.execute<{ kyc_status: string | null; kyb_status: string | null }>(
      sql`SELECT kyc_status, kyb_status FROM kyc_profiles WHERE user_id = ${userId} LIMIT 1`
    );
    const kycRow = kycProfile.rows[0];

    res.json({
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, country: user.country, role: user.role, status: (user as any).status ?? "ACTIVE", createdAt: user.createdAt },
      wallets,
      effectiveRates,
      fullFeeTable,
      fees: specificFees,
      kycDocuments: kycDocs,
      recentTransactions: recentTx,
      kycStatus: kycRow?.kyc_status ?? "NOT_STARTED",
      kybStatus: kycRow?.kyb_status ?? "NOT_STARTED",
    });
  } catch (err) {
    req.log.error({ err }, "Admin get user error");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch user" });
  }
});

// PUT /admin/users/:id/global-fees — set global rate override (all countries/operators)
router.put("/users/:id/global-fees", async (req: AuthRequest, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) {
    res.status(400).json({ error: "ValidationError", message: "Invalid user ID" });
    return;
  }

  const schema = z.object({
    transactionType: z.enum(["DEPOSIT", "WITHDRAWAL", "TRANSFER"]),
    rate: z.number().min(0).max(100),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: "Données invalides" });
    return;
  }

  const { transactionType, rate } = parse.data;
  const rateDecimal = rate / 100;

  try {
    const existing = await db
      .select({ id: userFeesTable.id })
      .from(userFeesTable)
      .where(and(
        eq(userFeesTable.userId, userId),
        eq(userFeesTable.country, GLOBAL_COUNTRY),
        eq(userFeesTable.operator, GLOBAL_OPERATOR),
        eq(userFeesTable.transactionType, transactionType),
      ))
      .limit(1);

    if (existing.length > 0) {
      await db.update(userFeesTable)
        .set({ rate: String(rateDecimal), updatedAt: new Date() })
        .where(eq(userFeesTable.id, existing[0].id));
    } else {
      await db.insert(userFeesTable).values({
        userId,
        country: GLOBAL_COUNTRY,
        operator: GLOBAL_OPERATOR,
        transactionType,
        rate: String(rateDecimal),
        minFee: 0,
        maxFee: null,
      });
    }

    req.log.info({ adminId: req.userId, targetUserId: userId, transactionType, rate }, "Global fee set");
    res.json({ success: true, message: "Taux mis à jour" });
  } catch (err) {
    req.log.error({ err }, "Admin set global fee error");
    res.status(500).json({ error: "InternalError", message: "Failed to set global fee" });
  }
});

// DELETE /admin/users/:id/global-fees/:type — reset a global fee to default
router.delete("/users/:id/global-fees/:type", async (req: AuthRequest, res) => {
  const userId = parseInt(req.params.id);
  const type = req.params.type;
  if (isNaN(userId)) {
    res.status(400).json({ error: "ValidationError", message: "Invalid user ID" });
    return;
  }

  try {
    await db.delete(userFeesTable).where(and(
      eq(userFeesTable.userId, userId),
      eq(userFeesTable.country, GLOBAL_COUNTRY),
      eq(userFeesTable.operator, GLOBAL_OPERATOR),
      eq(userFeesTable.transactionType, type),
    ));
    req.log.info({ adminId: req.userId, userId, type }, "Global fee reset to default");
    res.json({ success: true, message: "Taux réinitialisé au défaut" });
  } catch (err) {
    req.log.error({ err }, "Admin delete global fee error");
    res.status(500).json({ error: "InternalError", message: "Failed to reset fee" });
  }
});

// PUT /admin/users/:id/fees — set custom fee overrides for a user
router.put("/users/:id/fees", async (req: AuthRequest, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) {
    res.status(400).json({ error: "ValidationError", message: "Invalid user ID" });
    return;
  }

  const schema = z.object({
    country: z.string().length(2),
    operator: z.string().min(1).max(20),
    transactionType: z.enum(["DEPOSIT", "WITHDRAWAL", "TRANSFER"]),
    rate: z.number().min(0).max(1),
    minFee: z.number().int().min(0),
    maxFee: z.number().int().min(0).nullable(),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: "Données invalides" });
    return;
  }

  const { country, operator, transactionType, rate, minFee, maxFee } = parse.data;

  try {
    const existing = await db
      .select({ id: userFeesTable.id })
      .from(userFeesTable)
      .where(and(
        eq(userFeesTable.userId, userId),
        eq(userFeesTable.country, country),
        eq(userFeesTable.operator, operator),
        eq(userFeesTable.transactionType, transactionType),
      ))
      .limit(1);

    if (existing.length > 0) {
      await db.update(userFeesTable)
        .set({ rate: String(rate), minFee, maxFee, updatedAt: new Date() })
        .where(eq(userFeesTable.id, existing[0].id));
    } else {
      await db.insert(userFeesTable).values({ userId, country, operator, transactionType, rate: String(rate), minFee, maxFee });
    }

    req.log.info({ adminId: req.userId, targetUserId: userId, country, operator, transactionType }, "Custom fee set");
    res.json({ success: true, message: "Frais mis à jour" });
  } catch (err) {
    req.log.error({ err }, "Admin set fee error");
    res.status(500).json({ error: "InternalError", message: "Failed to set fee" });
  }
});

// DELETE /admin/users/:id/fees/:feeId — remove a custom fee override
router.delete("/users/:id/fees/:feeId", async (req: AuthRequest, res) => {
  const userId = parseInt(req.params.id);
  const feeId = parseInt(req.params.feeId);
  if (isNaN(userId) || isNaN(feeId)) {
    res.status(400).json({ error: "ValidationError", message: "Invalid ID" });
    return;
  }

  try {
    await db.delete(userFeesTable).where(and(eq(userFeesTable.id, feeId), eq(userFeesTable.userId, userId)));
    req.log.info({ adminId: req.userId, feeId }, "Custom fee removed");
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin delete fee error");
    res.status(500).json({ error: "InternalError", message: "Failed to delete fee" });
  }
});

// All operators per country from feeService FEE_TABLE
const ALL_OPERATOR_FEES: Array<{ country: string; operator: string; pixpayDeposit: number; pixpayWithdrawal: number }> = [
  // XAF — 1.5%
  { country: "CM", operator: "MTN",      pixpayDeposit: 0.015, pixpayWithdrawal: 0.015 },
  { country: "CM", operator: "ORANGE",   pixpayDeposit: 0.015, pixpayWithdrawal: 0.015 },
  { country: "CG", operator: "MTN",      pixpayDeposit: 0.015, pixpayWithdrawal: 0.015 },
  { country: "CG", operator: "AIRTEL",   pixpayDeposit: 0.015, pixpayWithdrawal: 0.015 },
  { country: "GA", operator: "AIRTEL",   pixpayDeposit: 0.015, pixpayWithdrawal: 0.015 },
  { country: "GA", operator: "MTN",      pixpayDeposit: 0.015, pixpayWithdrawal: 0.015 },
  // XOF — 1.9%
  { country: "CI", operator: "MTN",      pixpayDeposit: 0.019, pixpayWithdrawal: 0.019 },
  { country: "CI", operator: "ORANGE",   pixpayDeposit: 0.019, pixpayWithdrawal: 0.019 },
  { country: "CI", operator: "MOOV",     pixpayDeposit: 0.019, pixpayWithdrawal: 0.019 },
  { country: "CI", operator: "WAVE",     pixpayDeposit: 0.019, pixpayWithdrawal: 0.019 },
  { country: "SN", operator: "ORANGE",   pixpayDeposit: 0.019, pixpayWithdrawal: 0.019 },
  { country: "SN", operator: "FREE",     pixpayDeposit: 0.019, pixpayWithdrawal: 0.019 },
  { country: "SN", operator: "WAVE",     pixpayDeposit: 0.019, pixpayWithdrawal: 0.019 },
  { country: "BF", operator: "ORANGE",   pixpayDeposit: 0.019, pixpayWithdrawal: 0.019 },
  { country: "BF", operator: "MOOV",     pixpayDeposit: 0.019, pixpayWithdrawal: 0.019 },
  { country: "BJ", operator: "MTN",      pixpayDeposit: 0.019, pixpayWithdrawal: 0.019 },
  { country: "BJ", operator: "MOOV",     pixpayDeposit: 0.019, pixpayWithdrawal: 0.019 },
  { country: "GM", operator: "AFRICELL", pixpayDeposit: 0.019, pixpayWithdrawal: 0.019 },
  { country: "GM", operator: "QMONEY",   pixpayDeposit: 0.019, pixpayWithdrawal: 0.019 },
  { country: "GN", operator: "MTN",      pixpayDeposit: 0.019, pixpayWithdrawal: 0.019 },
  { country: "GN", operator: "ORANGE",   pixpayDeposit: 0.019, pixpayWithdrawal: 0.019 },
  { country: "GN", operator: "CELLCOM",  pixpayDeposit: 0.019, pixpayWithdrawal: 0.019 },
  { country: "ML", operator: "ORANGE",   pixpayDeposit: 0.019, pixpayWithdrawal: 0.019 },
  { country: "ML", operator: "MOOV",     pixpayDeposit: 0.019, pixpayWithdrawal: 0.019 },
  { country: "TG", operator: "TOGOCEL",  pixpayDeposit: 0.019, pixpayWithdrawal: 0.019 },
  { country: "TG", operator: "MOOV",     pixpayDeposit: 0.019, pixpayWithdrawal: 0.019 },
  // CDF — 3.0% dépôt / 3.5% retrait
  { country: "CD", operator: "VODACOM",  pixpayDeposit: 0.030, pixpayWithdrawal: 0.035 },
  { country: "CD", operator: "AIRTEL",   pixpayDeposit: 0.030, pixpayWithdrawal: 0.035 },
  { country: "CD", operator: "ORANGE",   pixpayDeposit: 0.030, pixpayWithdrawal: 0.035 },
  { country: "CD", operator: "AFRICELL", pixpayDeposit: 0.030, pixpayWithdrawal: 0.035 },
];

// GET /admin/users/:id/operator-fees — get all operator fees for a user (merged defaults + overrides)
router.get("/users/:id/operator-fees", async (req: AuthRequest, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) {
    res.status(400).json({ error: "ValidationError", message: "Invalid user ID" });
    return;
  }
  try {
    const rows = await pool.query<{
      country: string; operator: string;
      pixpay_deposit: string; pixpay_withdrawal: string;
      margin_deposit: string; margin_withdrawal: string;
    }>(
      "SELECT country, operator, pixpay_deposit, pixpay_withdrawal, margin_deposit, margin_withdrawal FROM user_operator_fees WHERE user_id = $1",
      [userId]
    );
    const saved = new Map(rows.rows.map((r) => [`${r.country}__${r.operator}`, r]));

    const result = ALL_OPERATOR_FEES.map((def) => {
      const key = `${def.country}__${def.operator}`;
      const row = saved.get(key);
      return {
        country: def.country,
        operator: def.operator,
        pixpayDeposit:    row ? parseFloat(row.pixpay_deposit)    : def.pixpayDeposit,
        pixpayWithdrawal: row ? parseFloat(row.pixpay_withdrawal) : def.pixpayWithdrawal,
        marginDeposit:    row ? parseFloat(row.margin_deposit)    : 0.015,
        marginWithdrawal: row ? parseFloat(row.margin_withdrawal) : 0.015,
        isCustom: !!row,
      };
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Get operator fees error");
    res.status(500).json({ error: "InternalError", message: "Failed to get operator fees" });
  }
});

// PUT /admin/users/:id/operator-fees — bulk upsert operator fees for a user
router.put("/users/:id/operator-fees", async (req: AuthRequest, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) {
    res.status(400).json({ error: "ValidationError", message: "Invalid user ID" });
    return;
  }

  const rowSchema = z.object({
    country: z.string().length(2),
    operator: z.string().min(2).max(20),
    pixpayDeposit: z.number().min(0).max(1),
    pixpayWithdrawal: z.number().min(0).max(1),
    marginDeposit: z.number().min(0).max(1),
    marginWithdrawal: z.number().min(0).max(1),
  });
  const schema = z.array(rowSchema).min(1);
  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: "Données invalides" });
    return;
  }

  try {
    for (const row of parse.data) {
      await pool.query(
        `INSERT INTO user_operator_fees (user_id, country, operator, pixpay_deposit, pixpay_withdrawal, margin_deposit, margin_withdrawal, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (user_id, country, operator) DO UPDATE SET
           pixpay_deposit = EXCLUDED.pixpay_deposit,
           pixpay_withdrawal = EXCLUDED.pixpay_withdrawal,
           margin_deposit = EXCLUDED.margin_deposit,
           margin_withdrawal = EXCLUDED.margin_withdrawal,
           updated_at = NOW()`,
        [userId, row.country, row.operator, row.pixpayDeposit, row.pixpayWithdrawal, row.marginDeposit, row.marginWithdrawal]
      );
    }
    req.log.info({ adminId: req.userId, userId, count: parse.data.length }, "Operator fees updated");
    res.json({ success: true, message: `${parse.data.length} frais mis à jour` });
  } catch (err) {
    req.log.error({ err }, "Put operator fees error");
    res.status(500).json({ error: "InternalError", message: "Failed to update operator fees" });
  }
});

// PATCH /admin/kyc/:docId — verify or reject a KYC document
router.patch("/kyc/:docId", async (req: AuthRequest, res) => {
  const docId = parseInt(req.params.docId);
  if (isNaN(docId)) {
    res.status(400).json({ error: "ValidationError", message: "Invalid document ID" });
    return;
  }

  const schema = z.object({
    status: z.enum(["VERIFIED", "REJECTED", "PENDING"]),
    notes: z.string().max(500).optional(),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: "Statut invalide" });
    return;
  }

  try {
    const [doc] = await db.select().from(kycDocumentsTable).where(eq(kycDocumentsTable.id, docId)).limit(1);
    if (!doc) {
      res.status(404).json({ error: "NotFound", message: "Document introuvable" });
      return;
    }

    await db.update(kycDocumentsTable)
      .set({ status: parse.data.status, notes: parse.data.notes ?? null, updatedAt: new Date() })
      .where(eq(kycDocumentsTable.id, docId));

    req.log.info({ adminId: req.userId, docId, status: parse.data.status, userId: doc.userId }, "KYC status updated");
    res.json({ success: true, message: `Document ${parse.data.status === "VERIFIED" ? "vérifié" : parse.data.status === "REJECTED" ? "rejeté" : "remis en attente"}` });
  } catch (err) {
    req.log.error({ err }, "Admin KYC update error");
    res.status(500).json({ error: "InternalError", message: "Failed to update KYC" });
  }
});

// GET /admin/kyc — list all KYC submissions grouped by user (profile + docs, no file_data)
router.get("/kyc", async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const profilesRes = await client.query(`
      SELECT
        kp.*,
        u.name AS user_name,
        u.email AS user_email
      FROM kyc_profiles kp
      INNER JOIN users u ON u.id = kp.user_id
      ORDER BY kp.updated_at DESC
    `);

    const docsRes = await client.query(`
      SELECT id, user_id, type, status, file_name, notes, created_at, updated_at
      FROM kyc_documents
      WHERE user_id = ANY($1::int[])
    `, [profilesRes.rows.map((r: any) => r.user_id)]);

    const docsMap: Record<number, any[]> = {};
    for (const d of docsRes.rows) {
      if (!docsMap[d.user_id]) docsMap[d.user_id] = [];
      docsMap[d.user_id].push({
        id: d.id, userId: d.user_id, type: d.type, status: d.status,
        fileName: d.file_name, notes: d.notes, createdAt: d.created_at, updatedAt: d.updated_at,
      });
    }

    const submissions = profilesRes.rows.map((p: any) => ({
      userId: p.user_id,
      userName: p.user_name,
      userEmail: p.user_email,
      profile: {
        id: p.id,
        fullName: p.full_name,
        dateOfBirth: p.date_of_birth,
        docType: p.doc_type,
        docNumber: p.doc_number,
        kycStatus: p.kyc_status,
        businessDescription: p.business_description,
        businessWebsite: p.business_website,
        businessCategory: p.business_category,
        businessType: p.business_type,
        niuNumber: p.niu_number,
        rccmNumber: p.rccm_number,
        kybStatus: p.kyb_status,
        adminNotes: p.admin_notes,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        hasSignature: !!p.signature_data,
      },
      documents: docsMap[p.user_id] ?? [],
    }));

    res.json({ submissions });
  } catch (err) {
    req.log.error({ err }, "Admin list KYC error");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch KYC submissions" });
  } finally {
    client.release();
  }
});

// GET /admin/kyc/doc/:docId/file — return base64 file data for a specific doc
router.get("/kyc/doc/:docId/file", async (req: AuthRequest, res) => {
  const docId = parseInt(req.params.docId);
  if (isNaN(docId)) { res.status(400).json({ error: "ValidationError", message: "ID invalide" }); return; }
  const client = await pool.connect();
  try {
    const result = await client.query(`SELECT file_data, file_name, type FROM kyc_documents WHERE id = $1`, [docId]);
    if (!result.rows[0]) { res.status(404).json({ error: "NotFound", message: "Document introuvable" }); return; }
    res.json({ fileData: result.rows[0].file_data, fileName: result.rows[0].file_name, type: result.rows[0].type });
  } finally {
    client.release();
  }
});

// GET /admin/kyc/signature/:userId — return signature data for a user
router.get("/kyc/signature/:userId", async (req: AuthRequest, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) { res.status(400).json({ error: "ValidationError", message: "ID invalide" }); return; }
  const client = await pool.connect();
  try {
    const result = await client.query(`SELECT signature_data FROM kyc_profiles WHERE user_id = $1`, [userId]);
    if (!result.rows[0]) { res.status(404).json({ error: "NotFound" }); return; }
    res.json({ signatureData: result.rows[0].signature_data });
  } finally {
    client.release();
  }
});

// PATCH /admin/kyc/profile/:userId — update KYC/KYB profile status
router.patch("/kyc/profile/:userId", async (req: AuthRequest, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) { res.status(400).json({ error: "ValidationError", message: "ID invalide" }); return; }
  const schema = z.object({
    kycStatus: z.enum(["NOT_STARTED", "PENDING", "APPROVED", "VERIFIED", "REJECTED"]).optional(),
    kybStatus: z.enum(["NOT_STARTED", "PENDING", "APPROVED", "VERIFIED", "REJECTED"]).optional(),
    adminNotes: z.string().max(1000).optional(),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "ValidationError", message: "Données invalides" }); return; }
  const client = await pool.connect();
  try {
    const { kycStatus, adminNotes } = parse.data;
    // Si le KYC est désactivé, le KYB est automatiquement désactivé aussi
    const kybStatus = kycStatus === "NOT_STARTED" ? "NOT_STARTED" : parse.data.kybStatus;
    // UPSERT: create the profile row if it doesn't exist yet, then update fields
    await client.query(
      `INSERT INTO kyc_profiles (user_id, kyc_status, kyb_status, admin_notes, updated_at)
       VALUES ($1, COALESCE($2, 'NOT_STARTED'), COALESCE($3, 'NOT_STARTED'), $4, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         kyc_status   = CASE WHEN $2 IS NOT NULL THEN $2 ELSE kyc_profiles.kyc_status END,
         kyb_status   = CASE WHEN $3 IS NOT NULL THEN $3 ELSE kyc_profiles.kyb_status END,
         admin_notes  = CASE WHEN $4 IS NOT NULL THEN $4 ELSE kyc_profiles.admin_notes END,
         updated_at   = NOW()`,
      [userId, kycStatus ?? null, kybStatus ?? null, adminNotes ?? null]
    );
    req.log.info({ adminId: req.userId, userId, ...parse.data }, "KYC profile status updated");
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin KYC profile update error");
    res.status(500).json({ error: "InternalError", message: "Erreur" });
  } finally {
    client.release();
  }
});

// PATCH /admin/users/:id/role — promote/demote user
router.patch("/users/:id/role", async (req: AuthRequest, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) {
    res.status(400).json({ error: "ValidationError", message: "Invalid user ID" });
    return;
  }
  if (userId === req.userId) {
    res.status(400).json({ error: "Forbidden", message: "Impossible de modifier votre propre rôle" });
    return;
  }

  const schema = z.object({ role: z.enum(["USER", "ADMIN"]) });
  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: "Rôle invalide" });
    return;
  }

  try {
    await db.update(usersTable).set({ role: parse.data.role }).where(eq(usersTable.id, userId));
    req.log.info({ adminId: req.userId, targetUserId: userId, role: parse.data.role }, "User role updated");
    res.json({ success: true, message: `Rôle mis à jour : ${parse.data.role}` });
  } catch (err) {
    req.log.error({ err }, "Admin update role error");
    res.status(500).json({ error: "InternalError", message: "Failed to update role" });
  }
});

// GET /admin/conversion — get platform-wide conversion fee settings
router.get("/conversion", async (req: AuthRequest, res) => {
  try {
    const rows = await db.execute(sql`SELECT * FROM conversion_fees ORDER BY pair`);
    res.json({ conversions: rows.rows });
  } catch (err) {
    req.log.error({ err }, "Admin get conversion error");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch conversion fees" });
  }
});

// PUT /admin/conversion/:pair — update conversion fee for a pair
router.put("/conversion/:pair", async (req: AuthRequest, res) => {
  const pair = req.params.pair; // e.g. "XAF:XOF"
  const VALID_PAIRS = ["XAF:XOF", "XAF:CDF", "XOF:CDF"];
  if (!VALID_PAIRS.includes(pair)) {
    res.status(400).json({ error: "ValidationError", message: "Paire invalide. Valeurs acceptées : XAF:XOF, XAF:CDF, XOF:CDF" });
    return;
  }

  const schema = z.object({
    rate: z.number().min(0).max(100),
    minAmount: z.number().int().min(0),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: parse.error.errors[0]?.message ?? "Données invalides" });
    return;
  }

  const { rate, minAmount } = parse.data;
  try {
    await db.execute(sql`
      UPDATE conversion_fees
      SET rate = ${(rate / 100).toFixed(4)}, min_amount = ${minAmount}, updated_at = NOW()
      WHERE pair = ${pair}
    `);
    req.log.info({ adminId: req.userId, pair, rate, minAmount }, "Conversion fee updated");
    res.json({ success: true, pair, rate: rate / 100, minAmount, message: `Frais de conversion ${pair} mis à jour` });
  } catch (err) {
    req.log.error({ err }, "Admin update conversion error");
    res.status(500).json({ error: "InternalError", message: "Impossible de mettre à jour les frais de conversion" });
  }
});

// PATCH /admin/users/:id/ban — ban or unban a user
router.patch("/users/:id/ban", async (req: AuthRequest, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) {
    res.status(400).json({ error: "ValidationError", message: "Invalid user ID" });
    return;
  }
  if (userId === req.userId) {
    res.status(400).json({ error: "Forbidden", message: "Impossible de bannir votre propre compte" });
    return;
  }

  const schema = z.object({ status: z.enum(["ACTIVE", "BANNED"]) });
  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: "Statut invalide (ACTIVE ou BANNED)" });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "NotFound", message: "Utilisateur introuvable" });
      return;
    }

    await db
      .update(usersTable)
      .set({ status: parse.data.status } as any)
      .where(eq(usersTable.id, userId));

    req.log.info({ adminId: req.userId, targetUserId: userId, status: parse.data.status }, "User ban status updated");
    res.json({
      success: true,
      status: parse.data.status,
      message: parse.data.status === "BANNED" ? "Utilisateur banni avec succès" : "Utilisateur réactivé avec succès",
    });
  } catch (err) {
    req.log.error({ err }, "Admin ban user error");
    res.status(500).json({ error: "InternalError", message: "Impossible de modifier le statut" });
  }
});

// POST /admin/transactions/:id/refund-crypto — refund a stuck PENDING USDT crypto withdrawal
router.post("/transactions/:id/refund-crypto", async (req: AuthRequest, res) => {
  const txId = parseInt(req.params.id);
  if (isNaN(txId)) { res.status(400).json({ error: "ValidationError", message: "Invalid ID" }); return; }
  try {
    const [tx] = await db.select().from(transactionsTable)
      .where(and(eq(transactionsTable.id, txId), eq(transactionsTable.status, "PENDING"), eq(transactionsTable.currency, "USDT")))
      .limit(1);
    if (!tx) { res.status(404).json({ error: "NotFound", message: "Transaction PENDING USDT introuvable" }); return; }

    const [wallet] = await db.select().from(walletsTable)
      .where(and(eq(walletsTable.userId, tx.userId), eq(walletsTable.currency, "USDT"))).limit(1);
    if (!wallet) { res.status(404).json({ error: "NotFound", message: "Portefeuille USDT introuvable" }); return; }

    const refundAmount = parseFloat(tx.amount);
    await db.update(walletsTable).set({
      balance: (parseFloat(wallet.balance) + refundAmount).toFixed(8),
      updatedAt: new Date(),
    }).where(eq(walletsTable.id, wallet.id));
    await db.update(transactionsTable).set({
      status: "FAILED",
      metadata: { ...(tx.metadata as object ?? {}), refundedAt: new Date().toISOString(), refundedBy: "admin", reason: "Retrait remboursé manuellement" },
      updatedAt: new Date(),
    }).where(eq(transactionsTable.id, txId));

    req.log.info({ adminId: req.userId, txId, refundAmount }, "Crypto withdrawal refunded by admin");
    res.json({ success: true, refundAmount, message: `${refundAmount} USDT remboursés sur le portefeuille de l'utilisateur` });
  } catch (err) {
    req.log.error({ err }, "Refund crypto error");
    res.status(500).json({ error: "InternalError", message: "Erreur lors du remboursement" });
  }
});

// PUT /admin/users/:id/wallets/:currency — update a user's wallet balance
router.put("/users/:id/wallets/:currency", async (req: AuthRequest, res) => {
  const userId = parseInt(req.params.id);
  const currency = req.params.currency.toUpperCase();

  if (isNaN(userId)) {
    res.status(400).json({ error: "ValidationError", message: "Invalid user ID" });
    return;
  }

  const schema = z.object({
    balance: z.number().min(0, "Le solde ne peut pas être négatif"),
    reason: z.string().max(200).optional(),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: parse.error.errors[0]?.message ?? "Solde invalide" });
    return;
  }

  try {
    const [wallet] = await db
      .select()
      .from(walletsTable)
      .where(and(eq(walletsTable.userId, userId), eq(walletsTable.currency, currency)))
      .limit(1);

    if (!wallet) {
      res.status(404).json({ error: "NotFound", message: `Aucun portefeuille ${currency} pour cet utilisateur` });
      return;
    }

    const oldBalance = parseFloat(wallet.balance);
    const newBalance = parse.data.balance;

    await db
      .update(walletsTable)
      .set({ balance: newBalance.toString(), updatedAt: new Date() })
      .where(eq(walletsTable.id, wallet.id));

    req.log.info(
      { adminId: req.userId, targetUserId: userId, currency, oldBalance, newBalance, reason: parse.data.reason },
      "Admin wallet balance updated"
    );

    res.json({
      success: true,
      currency,
      oldBalance,
      newBalance,
      message: `Solde ${currency} mis à jour : ${newBalance.toLocaleString("fr-FR")} ${currency}`,
    });
  } catch (err) {
    req.log.error({ err }, "Admin update wallet error");
    res.status(500).json({ error: "InternalError", message: "Impossible de modifier le solde" });
  }
});

// ─── PixPay Services Configuration ─────────────────────────────────────────────

// GET /admin/pixpay/services — list all pixpay_services rows
router.get("/pixpay/services", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT id, operator, country, currency, type, service_id, active, notes, updated_at
      FROM pixpay_services
      ORDER BY currency, country, operator, type
    `);
    res.json({ services: result.rows });
  } catch (err) {
    res.status(500).json({ error: "InternalError", message: "Impossible de charger les services PixPay" });
  }
});

// PUT /admin/pixpay/services — upsert a row (operator+country+currency+type)
router.put("/pixpay/services", async (req: AuthRequest, res) => {
  const schema = z.object({
    operator: z.string().min(2).toUpperCase(),
    country: z.string().length(2).toUpperCase().optional().nullable(),
    currency: z.enum(["XAF", "XOF", "CDF"]),
    type: z.enum(["DEPOSIT", "WITHDRAWAL"]),
    serviceId: z.number().int().min(0),
    active: z.boolean().default(true),
    notes: z.string().optional(),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: "Paramètres invalides" });
    return;
  }

  const { operator, country, currency, type, serviceId, active, notes } = parse.data;

  try {
    await db.execute(sql`
      INSERT INTO pixpay_services (operator, country, currency, type, service_id, active, notes, updated_at)
      VALUES (${operator}, ${country ?? null}, ${currency}, ${type}, ${serviceId}, ${active}, ${notes ?? null}, NOW())
      ON CONFLICT (operator, country, currency, type)
      DO UPDATE SET service_id = ${serviceId}, active = ${active}, notes = ${notes ?? null}, updated_at = NOW()
    `);

    req.log.info({ adminId: req.userId, operator, country, currency, type, serviceId, active }, "PixPay service upserted");
    res.json({ success: true, message: `Service PixPay ${operator} (${country ?? "global"}) ${currency} ${type} mis à jour` });
  } catch (err) {
    req.log.error({ err }, "Admin upsert pixpay service error");
    res.status(500).json({ error: "InternalError", message: "Impossible de mettre à jour le service PixPay" });
  }
});

// GET /admin/pixpay/config — list platform_config keys
router.get("/pixpay/config", async (_req, res) => {
  try {
    const result = await db.execute(sql`SELECT key, value, updated_at FROM platform_config ORDER BY key`);
    res.json({ config: result.rows });
  } catch (err) {
    res.status(500).json({ error: "InternalError", message: "Impossible de charger la configuration" });
  }
});

// PUT /admin/pixpay/config — set a platform_config value
router.put("/pixpay/config", async (req: AuthRequest, res) => {
  const schema = z.object({
    key: z.string().min(1).max(100),
    value: z.string(),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: "Paramètres invalides" });
    return;
  }

  const { key, value } = parse.data;

  try {
    await db.execute(sql`
      INSERT INTO platform_config (key, value, updated_at)
      VALUES (${key}, ${value}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()
    `);

    req.log.info({ adminId: req.userId, key }, "Platform config updated");
    res.json({ success: true, message: `Configuration ${key} mise à jour` });
  } catch (err) {
    req.log.error({ err }, "Admin update platform config error");
    res.status(500).json({ error: "InternalError", message: "Impossible de mettre à jour la configuration" });
  }
});

// ── Admin Transactions ────────────────────────────────────────────────────────

// GET /admin/transactions?page=1&limit=50&status=SUCCESS&type=DEPOSIT&search=xxx
router.get("/transactions", async (req: AuthRequest, res) => {
  const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit  = Math.min(100, parseInt(req.query.limit as string) || 50);
  const offset = (page - 1) * limit;
  const status = (req.query.status as string) || "";
  const type   = (req.query.type   as string) || "";
  const search = (req.query.search as string) || "";

  const params: unknown[] = [];
  const conditions: string[] = [];

  if (status) { params.push(status); conditions.push(`t.status = $${params.length}`); }
  if (type)   { params.push(type);   conditions.push(`t.type = $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    conditions.push(`(t.reference ILIKE $${idx} OR u.email ILIKE $${idx} OR u.name ILIKE $${idx})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM transactions t JOIN users u ON t.user_id = u.id ${where}`,
      params
    );
    const total = countRes.rows[0]?.total ?? 0;

    params.push(limit, offset);
    const rows = await pool.query(
      `SELECT t.id, t.type, t.status, t.amount, t.fee, t.net_amount,
              t.currency, t.country, t.operator, t.phone, t.reference,
              t.provider_reference, t.fee_rate, t.metadata, t.created_at, t.updated_at,
              u.id AS user_id, u.email AS user_email, u.name AS user_name
       FROM transactions t
       JOIN users u ON t.user_id = u.id
       ${where}
       ORDER BY t.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      transactions: rows.rows.map((r) => ({
        id:                r.id,
        type:              r.type,
        status:            r.status,
        amount:            parseFloat(r.amount),
        fee:               parseFloat(r.fee),
        netAmount:         parseFloat(r.net_amount),
        currency:          r.currency,
        country:           r.country,
        operator:          r.operator,
        phone:             r.phone,
        reference:         r.reference,
        providerReference: r.provider_reference ?? null,
        feeRate:           r.fee_rate ? parseFloat(r.fee_rate) : null,
        metadata:          r.metadata,
        createdAt:         r.created_at,
        updatedAt:         r.updated_at,
        userId:            r.user_id,
        userEmail:         r.user_email,
        userName:          r.user_name,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Admin get transactions error");
    res.status(500).json({ error: "InternalError", message: "Erreur lors de la récupération des transactions" });
  }
});

// GET /admin/transactions/:id
router.get("/transactions/:id", async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "BadRequest", message: "ID invalide" }); return; }

  try {
    const result = await pool.query(
      `SELECT t.*, u.id AS user_id, u.email AS user_email, u.name AS user_name
       FROM transactions t
       JOIN users u ON t.user_id = u.id
       WHERE t.id = $1 LIMIT 1`,
      [id]
    );
    if (!result.rows[0]) { res.status(404).json({ error: "NotFound", message: "Transaction introuvable" }); return; }
    const r = result.rows[0];
    res.json({
      id:                r.id,
      type:              r.type,
      status:            r.status,
      amount:            parseFloat(r.amount),
      fee:               parseFloat(r.fee),
      netAmount:         parseFloat(r.net_amount),
      currency:          r.currency,
      country:           r.country,
      operator:          r.operator,
      phone:             r.phone,
      reference:         r.reference,
      providerReference: r.provider_reference ?? null,
      feeRate:           r.fee_rate ? parseFloat(r.fee_rate) : null,
      metadata:          r.metadata,
      createdAt:         r.created_at,
      updatedAt:         r.updated_at,
      userId:            r.user_id,
      userEmail:         r.user_email,
      userName:          r.user_name,
    });
  } catch (err) {
    req.log.error({ err }, "Admin get transaction detail error");
    res.status(500).json({ error: "InternalError", message: "Erreur lors de la récupération" });
  }
});

// ── Exchange Requests (USDT → Fiat) ─────────────────────────────────────────
// GET /admin/exchanges — list pending exchange requests
router.get("/exchanges", async (req: AuthRequest, res) => {
  try {
    const result = await db.execute(sql`
      SELECT ce.*, u.email AS user_email, u.name AS user_name
      FROM crypto_exchanges ce
      JOIN users u ON u.id = ce.user_id
      ORDER BY ce.created_at DESC
      LIMIT 100
    `);
    res.json(result.rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      userEmail: r.user_email,
      userName: r.user_name,
      fromCurrency: r.from_currency,
      toCurrency: r.to_currency,
      fromAmount: parseFloat(r.from_amount),
      usdtAmount: parseFloat(r.usdt_amount),
      toAmount: r.to_amount ? parseFloat(r.to_amount) : null,
      exchangeRate: parseFloat(r.exchange_rate),
      feeAmount: parseFloat(r.fee_amount),
      status: r.status,
      txStep1Id: r.tx_step1_id,
      txStep2Id: r.tx_step2_id,
      adminNotes: r.admin_notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })));
  } catch (err) {
    req.log.error({ err }, "Admin exchanges list error");
    res.status(500).json({ error: "InternalError", message: "Erreur lors de la récupération des échanges" });
  }
});

// PATCH /admin/exchanges/:id/approve — approve a USDT→fiat exchange request
router.patch("/exchanges/:id/approve", async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { notes, finalAmount } = req.body as { notes?: string; finalAmount?: number };

  try {
    const result = await db.execute(sql`
      SELECT ce.*, t.net_amount, t.currency, t.phone, t.user_id, t.metadata
      FROM crypto_exchanges ce
      LEFT JOIN transactions t ON t.id = ce.tx_step2_id
      WHERE ce.id = ${id} AND ce.status = 'PENDING_ADMIN'
      LIMIT 1
    `);

    if (!result.rows[0]) {
      res.status(404).json({ error: "NotFound", message: "Demande d'échange introuvable ou déjà traitée" });
      return;
    }

    const ex = result.rows[0] as any;

    // Use current admin rate (if set) to recalculate the fiat amount
    // net_usdt = gross - fee (already taken at step2 creation)
    const netUsdt = parseFloat(ex.usdt_amount) - parseFloat(ex.fee_amount ?? "0");
    const currentRate = await getEffectiveRate("USDT", ex.to_currency);
    const confirmedAmount = finalAmount ?? parseFloat((netUsdt * currentRate).toFixed(2));

    // Credit fiat wallet
    const [fiatWallet] = await db
      .select()
      .from(walletsTable)
      .where(and(eq(walletsTable.userId, ex.user_id), eq(walletsTable.currency, ex.to_currency)))
      .limit(1);

    if (fiatWallet) {
      await db.update(walletsTable).set({
        balance: (parseFloat(fiatWallet.balance) + confirmedAmount).toFixed(2),
        updatedAt: new Date(),
      }).where(eq(walletsTable.id, fiatWallet.id));
    }

    // Deduct USDT from balance + unlock
    await db.execute(sql`
      UPDATE wallets SET
        balance = balance - ${ex.usdt_amount},
        locked_balance = GREATEST(0, locked_balance - ${ex.usdt_amount}),
        updated_at = NOW()
      WHERE user_id = ${ex.user_id} AND currency = 'USDT'
    `);

    // Update crypto_exchange record
    await db.execute(sql`
      UPDATE crypto_exchanges
      SET status = 'COMPLETED', to_amount = ${confirmedAmount}, admin_notes = ${notes ?? null}, updated_at = NOW()
      WHERE id = ${id}
    `);

    // Update transaction status
    if (ex.tx_step2_id) {
      await db.update(transactionsTable).set({
        status: "SUCCESS",
        netAmount: confirmedAmount.toFixed(2),
        metadata: {
          ...((typeof ex.metadata === "object" ? ex.metadata : {}) as object),
          approvedAt: new Date().toISOString(),
          adminNotes: notes,
          finalAmount: confirmedAmount,
        },
        updatedAt: new Date(),
      }).where(eq(transactionsTable.id, ex.tx_step2_id));
    }

    res.json({ success: true, message: `Échange approuvé — ${confirmedAmount} ${ex.to_currency} crédités.` });
  } catch (err) {
    req.log.error({ err, id }, "Admin approve exchange error");
    res.status(500).json({ error: "InternalError", message: "Erreur lors de l'approbation" });
  }
});

// PATCH /admin/exchanges/:id/reject — reject a USDT→fiat exchange request
router.patch("/exchanges/:id/reject", async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { notes } = req.body as { notes?: string };

  try {
    const result = await db.execute(sql`
      SELECT ce.*, t.user_id
      FROM crypto_exchanges ce
      LEFT JOIN transactions t ON t.id = ce.tx_step2_id
      WHERE ce.id = ${id} AND ce.status = 'PENDING_ADMIN'
      LIMIT 1
    `);

    if (!result.rows[0]) {
      res.status(404).json({ error: "NotFound", message: "Demande introuvable ou déjà traitée" });
      return;
    }

    const ex = result.rows[0] as any;

    // Unlock USDT (refund)
    await db.execute(sql`
      UPDATE wallets SET
        locked_balance = GREATEST(0, locked_balance - ${ex.usdt_amount}),
        updated_at = NOW()
      WHERE user_id = ${ex.user_id} AND currency = 'USDT'
    `);

    // Update crypto_exchange
    await db.execute(sql`
      UPDATE crypto_exchanges
      SET status = 'REJECTED', admin_notes = ${notes ?? null}, updated_at = NOW()
      WHERE id = ${id}
    `);

    // Update transaction
    if (ex.tx_step2_id) {
      await db.update(transactionsTable).set({
        status: "FAILED",
        metadata: {
          rejectedAt: new Date().toISOString(),
          adminNotes: notes,
        },
        updatedAt: new Date(),
      }).where(eq(transactionsTable.id, ex.tx_step2_id));
    }

    res.json({ success: true, message: "Demande d'échange rejetée — USDT déverrouillé." });
  } catch (err) {
    req.log.error({ err, id }, "Admin reject exchange error");
    res.status(500).json({ error: "InternalError", message: "Erreur lors du rejet" });
  }
});

// ─── USDT Exchange Rates ────────────────────────────────────────────────────

// GET /admin/usdt-rates — get all admin-defined USDT exchange rates
router.get("/usdt-rates", async (req: AuthRequest, res) => {
  try {
    const rates = await getAllUsdtRates();
    res.json({ rates });
  } catch (err) {
    req.log.error({ err }, "Admin get usdt-rates error");
    res.status(500).json({ error: "InternalError", message: "Impossible de récupérer les taux" });
  }
});

// PUT /admin/usdt-rates/:pair — set rate for a USDT pair (0 = use live rate)
router.put("/usdt-rates/:pair", async (req: AuthRequest, res) => {
  const pair = req.params.pair;
  if (!(USDT_PAIRS as readonly string[]).includes(pair)) {
    res.status(400).json({ error: "ValidationError", message: `Paire invalide. Valides: ${USDT_PAIRS.join(", ")}` });
    return;
  }
  const schema = z.object({ rate: z.number().min(0, "Taux doit être ≥ 0") });
  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: parse.error.errors[0]?.message ?? "Paramètres invalides" });
    return;
  }
  try {
    await setUsdtRate(pair, parse.data.rate);
    req.log.info({ adminId: req.userId, pair, rate: parse.data.rate }, "USDT rate updated by admin");
    res.json({ success: true, pair, rate: parse.data.rate, message: `Taux ${pair} mis à jour (0 = taux marché)` });
  } catch (err) {
    req.log.error({ err }, "Admin set usdt-rate error");
    res.status(500).json({ error: "InternalError", message: "Impossible de mettre à jour le taux" });
  }
});

// ── Support Links ─────────────────────────────────────────────────────────────
router.get("/support-links", async (_req, res) => {
  try {
    const r = await pool.query("SELECT whatsapp_url, facebook_url, telegram_url, phone_url FROM support_links WHERE id = 1");
    res.json(r.rows[0] ?? { whatsapp_url: "", facebook_url: "", telegram_url: "", phone_url: "" });
  } catch (err) {
    res.status(500).json({ error: "InternalError" });
  }
});

router.put("/support-links", async (req: AuthRequest, res) => {
  const schema = z.object({
    whatsapp_url: z.string().max(500).default(""),
    facebook_url: z.string().max(500).default(""),
    telegram_url: z.string().max(500).default(""),
    phone_url:    z.string().max(500).default(""),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "ValidationError" }); return; }
  try {
    await pool.query(
      `UPDATE support_links SET whatsapp_url=$1, facebook_url=$2, telegram_url=$3, phone_url=$4, updated_at=NOW() WHERE id=1`,
      [parse.data.whatsapp_url, parse.data.facebook_url, parse.data.telegram_url, parse.data.phone_url]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "InternalError" });
  }
});

// ── Per-user USDT fees ────────────────────────────────────────────────────────
// Stored in user_fees table:
//   DEPOSIT  → country='USDT', operator='NOWPAYMENTS'
//   WITHDRAWAL → country='USDT', operator='CRYPTO'
const USDT_COUNTRY = "USDT";
const USDT_OP_DEPOSIT = "NOWPAYMENTS";
const USDT_OP_WITHDRAW = "CRYPTO";

// GET /admin/users/:id/usdt-fees
router.get("/users/:id/usdt-fees", async (req: AuthRequest, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) { res.status(400).json({ error: "ValidationError", message: "Invalid user ID" }); return; }
  try {
    const rows = await db.select().from(userFeesTable).where(
      and(eq(userFeesTable.userId, userId), eq(userFeesTable.country, USDT_COUNTRY))
    );
    const deposit = rows.find((r) => r.operator === USDT_OP_DEPOSIT && r.transactionType === "DEPOSIT");
    const withdraw = rows.find((r) => r.operator === USDT_OP_WITHDRAW && r.transactionType === "WITHDRAWAL");
    res.json({
      depositRate:  deposit  ? parseFloat(deposit.rate)  : null,
      withdrawRate: withdraw ? parseFloat(withdraw.rate) : null,
      depositDefault:  0,
      withdrawDefault: 0.01,
    });
  } catch (err) {
    res.status(500).json({ error: "InternalError" });
  }
});

// PUT /admin/users/:id/usdt-fees
router.put("/users/:id/usdt-fees", async (req: AuthRequest, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) { res.status(400).json({ error: "ValidationError", message: "Invalid user ID" }); return; }

  const schema = z.object({
    depositRate:  z.number().min(0).max(1).nullable().optional(),
    withdrawRate: z.number().min(0).max(1).nullable().optional(),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "ValidationError", message: "Données invalides" }); return; }

  const { depositRate, withdrawRate } = parse.data;

  async function upsertUsdtFee(operator: string, txType: string, rate: number | null | undefined) {
    if (rate === undefined) return;
    if (rate === null) {
      // delete custom override
      await db.delete(userFeesTable).where(and(
        eq(userFeesTable.userId, userId),
        eq(userFeesTable.country, USDT_COUNTRY),
        eq(userFeesTable.operator, operator),
        eq(userFeesTable.transactionType, txType),
      ));
      return;
    }
    const existing = await db.select({ id: userFeesTable.id }).from(userFeesTable).where(and(
      eq(userFeesTable.userId, userId),
      eq(userFeesTable.country, USDT_COUNTRY),
      eq(userFeesTable.operator, operator),
      eq(userFeesTable.transactionType, txType),
    )).limit(1);
    if (existing.length > 0) {
      await db.update(userFeesTable).set({ rate: String(rate), updatedAt: new Date() }).where(eq(userFeesTable.id, existing[0].id));
    } else {
      await db.insert(userFeesTable).values({ userId, country: USDT_COUNTRY, operator, transactionType: txType, rate: String(rate), minFee: 0, maxFee: null });
    }
  }

  try {
    await upsertUsdtFee(USDT_OP_DEPOSIT, "DEPOSIT", depositRate);
    await upsertUsdtFee(USDT_OP_WITHDRAW, "WITHDRAWAL", withdrawRate);
    res.json({ success: true, message: "Frais USDT mis à jour" });
  } catch (err) {
    req.log.error({ err }, "Admin set USDT fee error");
    res.status(500).json({ error: "InternalError" });
  }
});

export default router;

