import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, walletsTable, transactionsTable, kycDocumentsTable, userFeesTable } from "@workspace/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/authMiddleware";
import { adminMiddleware } from "../middlewares/adminMiddleware";
import { z } from "zod";
import { FEE_TABLE, CURRENCY_MAP } from "../services/feeService";

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
    const [{ totalUsers }] = await db.select({ totalUsers: sql<number>`count(*)::int` }).from(usersTable);
    const [{ pendingKyc }] = await db
      .select({ pendingKyc: sql<number>`count(*)::int` })
      .from(kycDocumentsTable)
      .where(eq(kycDocumentsTable.status, "PENDING"));
    const [{ totalTx }] = await db.select({ totalTx: sql<number>`count(*)::int` }).from(transactionsTable);
    const [{ customFees }] = await db.select({ customFees: sql<number>`count(distinct user_id)::int` }).from(userFeesTable);

    res.json({ totalUsers, pendingKyc, totalTx, customFees });
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

    res.json({
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, country: user.country, role: user.role, createdAt: user.createdAt },
      wallets,
      effectiveRates,
      fullFeeTable,
      fees: specificFees,
      kycDocuments: kycDocs,
      recentTransactions: recentTx,
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

// GET /admin/kyc — list all pending KYC documents
router.get("/kyc", async (req: AuthRequest, res) => {
  try {
    const docs = await db
      .select({
        id: kycDocumentsTable.id,
        userId: kycDocumentsTable.userId,
        type: kycDocumentsTable.type,
        status: kycDocumentsTable.status,
        fileName: kycDocumentsTable.fileName,
        notes: kycDocumentsTable.notes,
        createdAt: kycDocumentsTable.createdAt,
        updatedAt: kycDocumentsTable.updatedAt,
        userName: usersTable.name,
        userEmail: usersTable.email,
      })
      .from(kycDocumentsTable)
      .innerJoin(usersTable, eq(kycDocumentsTable.userId, usersTable.id))
      .orderBy(desc(kycDocumentsTable.createdAt));

    res.json({ documents: docs });
  } catch (err) {
    req.log.error({ err }, "Admin list KYC error");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch KYC documents" });
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

export default router;
