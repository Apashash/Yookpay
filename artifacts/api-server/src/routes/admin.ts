import { Router } from "express";
import { db, pool } from "@workspace/db";
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
    const [
      [{ totalUsers }],
      [{ pendingKyc }],
      [{ totalTx }],
      [{ customFees }],
      [{ totalVolume, totalMargin, successTx }],
      [{ verifiedUsers }],
      txByCurrency,
    ] = await Promise.all([
      db.select({ totalUsers: sql<number>`count(*)::int` }).from(usersTable),
      db.select({ pendingKyc: sql<number>`count(*)::int` }).from(kycDocumentsTable).where(eq(kycDocumentsTable.status, "PENDING")),
      db.select({ totalTx: sql<number>`count(*)::int` }).from(transactionsTable),
      db.select({ customFees: sql<number>`count(distinct user_id)::int` }).from(userFeesTable),
      db.select({
        totalVolume: sql<string>`coalesce(sum(amount::numeric), 0)`,
        totalMargin: sql<string>`coalesce(sum(fee::numeric), 0)`,
        successTx:   sql<number>`count(*)::int`,
      }).from(transactionsTable).where(eq(transactionsTable.status, "SUCCESS")),
      db.select({ verifiedUsers: sql<number>`count(distinct user_id)::int` }).from(kycDocumentsTable).where(eq(kycDocumentsTable.status, "VERIFIED")),
      db.select({
        currency: transactionsTable.currency,
        volume:   sql<string>`coalesce(sum(amount::numeric), 0)`,
        margin:   sql<string>`coalesce(sum(fee::numeric), 0)`,
        count:    sql<number>`count(*)::int`,
      }).from(transactionsTable).where(eq(transactionsTable.status, "SUCCESS")).groupBy(transactionsTable.currency),
    ]);

    res.json({
      totalUsers,
      pendingKyc,
      totalTx,
      customFees,
      successTx,
      totalVolume: parseFloat(totalVolume),
      totalMargin: parseFloat(totalMargin),
      verifiedUsers,
      byCurrency: txByCurrency.map((r) => ({
        currency: r.currency,
        volume: parseFloat(r.volume),
        margin: parseFloat(r.margin),
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

    res.json({
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, country: user.country, role: user.role, status: (user as any).status ?? "ACTIVE", createdAt: user.createdAt },
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
    kycStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
    kybStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
    adminNotes: z.string().max(1000).optional(),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "ValidationError", message: "Données invalides" }); return; }
  const client = await pool.connect();
  try {
    const sets: string[] = ["updated_at = NOW()"];
    const values: any[] = [userId];
    if (parse.data.kycStatus) { values.push(parse.data.kycStatus); sets.push(`kyc_status = $${values.length}`); }
    if (parse.data.kybStatus) { values.push(parse.data.kybStatus); sets.push(`kyb_status = $${values.length}`); }
    if (parse.data.adminNotes !== undefined) { values.push(parse.data.adminNotes); sets.push(`admin_notes = $${values.length}`); }
    await client.query(`UPDATE kyc_profiles SET ${sets.join(", ")} WHERE user_id = $1`, values);
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

export default router;
