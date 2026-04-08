import { Router } from "express";
import { pool } from "@workspace/db";
import { db } from "@workspace/db";
import { kycDocumentsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/authMiddleware";
import { z } from "zod";

const router = Router();

const KYC_DOC_TYPES = ["ID_FRONT", "ID_BACK"] as const;
const KYB_DOC_TYPES = ["KYB_STATUTS", "KYB_RCCM", "KYB_NIU", "KYB_PLAN_LOC"] as const;
const ALL_DOC_TYPES = [...KYC_DOC_TYPES, ...KYB_DOC_TYPES] as const;
type DocType = typeof ALL_DOC_TYPES[number];

// GET /kyc — return profile + docs
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const profileRes = await client.query(
      `SELECT * FROM kyc_profiles WHERE user_id = $1 LIMIT 1`,
      [req.userId]
    );
    const raw = profileRes.rows[0] ?? null;
    const profile = raw ? {
      userId:              raw.user_id,
      fullName:            raw.full_name,
      dateOfBirth:         raw.date_of_birth,
      docType:             raw.doc_type,
      docNumber:           raw.doc_number,
      kycStatus:           raw.kyc_status,
      kybStatus:           raw.kyb_status,
      businessDescription: raw.business_description,
      businessWebsite:     raw.business_website,
      businessCategory:    raw.business_category,
      businessType:        raw.business_type,
      niuNumber:           raw.niu_number,
      rccmNumber:          raw.rccm_number,
      signatureData:       raw.signature_data,
      adminNotes:          raw.admin_notes,
    } : null;

    const docs = await db
      .select({
        id: kycDocumentsTable.id,
        type: kycDocumentsTable.type,
        status: kycDocumentsTable.status,
        fileName: kycDocumentsTable.fileName,
        notes: kycDocumentsTable.notes,
        createdAt: kycDocumentsTable.createdAt,
        updatedAt: kycDocumentsTable.updatedAt,
      })
      .from(kycDocumentsTable)
      .where(eq(kycDocumentsTable.userId, req.userId!));

    res.json({ profile, documents: docs });
  } catch (err) {
    req.log.error({ err }, "Get KYC error");
    res.status(500).json({ error: "InternalError", message: "Erreur lors de la récupération KYC" });
  } finally {
    client.release();
  }
});

// POST /kyc/identity — save KYC step 1 (identity info + ID scans)
router.post("/identity", authMiddleware, async (req: AuthRequest, res) => {
  const schema = z.object({
    fullName:    z.string().min(2).max(255),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    docType:     z.enum(["CNI", "PASSEPORT", "PERMIS", "SEJOUR"]),
    docNumber:   z.string().min(1).max(100),
    frontFile:   z.object({ name: z.string(), data: z.string() }).optional(),
    backFile:    z.object({ name: z.string(), data: z.string() }).optional(),
    selfieFile:  z.object({ name: z.string(), data: z.string() }).optional(),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: "Données invalides", issues: parse.error.issues });
    return;
  }

  const { fullName, dateOfBirth, docType, docNumber, frontFile, backFile, selfieFile } = parse.data;
  const client = await pool.connect();

  try {
    await client.query(`
      INSERT INTO kyc_profiles (user_id, full_name, date_of_birth, doc_type, doc_number, kyc_status, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'PENDING', NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        date_of_birth = EXCLUDED.date_of_birth,
        doc_type = EXCLUDED.doc_type,
        doc_number = EXCLUDED.doc_number,
        kyc_status = 'PENDING',
        updated_at = NOW()
    `, [req.userId, fullName, dateOfBirth, docType, docNumber]);

    // Upsert file docs
    for (const [docTypeKey, file] of [["ID_FRONT", frontFile], ["ID_BACK", backFile], ["SELFIE", selfieFile]] as const) {
      if (!file) continue;
      const existing = await db.select({ id: kycDocumentsTable.id })
        .from(kycDocumentsTable)
        .where(and(eq(kycDocumentsTable.userId, req.userId!), eq(kycDocumentsTable.type, docTypeKey)))
        .limit(1);

      if (existing.length > 0) {
        await db.update(kycDocumentsTable)
          .set({ fileName: file.name, fileData: file.data, status: "PENDING", updatedAt: new Date() })
          .where(eq(kycDocumentsTable.id, existing[0].id));
      } else {
        await db.insert(kycDocumentsTable)
          .values({ userId: req.userId!, type: docTypeKey, fileName: file.name, fileData: file.data, status: "PENDING" });
      }
    }

    req.log.info({ userId: req.userId }, "KYC identity submitted");
    res.json({ success: true, message: "Informations d'identité enregistrées" });
  } catch (err) {
    req.log.error({ err }, "KYC identity error");
    res.status(500).json({ error: "InternalError", message: "Erreur lors de l'enregistrement" });
  } finally {
    client.release();
  }
});

// POST /kyc/kyb — save KYB step 2 (business info + docs + signature)
router.post("/kyb", authMiddleware, async (req: AuthRequest, res) => {
  const schema = z.object({
    businessDescription: z.string().min(10).max(4000),
    businessWebsite:     z.string().max(500).optional().default(""),
    businessCategory:    z.string().min(1).max(200),
    businessType:        z.string().min(1).max(50),
    niuNumber:           z.string().max(100).optional().default(""),
    rccmNumber:          z.string().max(100).optional().default(""),
    signatureData:       z.string().min(1),
    statutsFile:         z.object({ name: z.string(), data: z.string() }).optional(),
    rccmFile:            z.object({ name: z.string(), data: z.string() }).optional(),
    niuFile:             z.object({ name: z.string(), data: z.string() }).optional(),
    planLocFile:         z.object({ name: z.string(), data: z.string() }).optional(),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: "Données invalides", issues: parse.error.issues });
    return;
  }

  const { businessDescription, businessWebsite, businessCategory, businessType, niuNumber, rccmNumber,
    signatureData, statutsFile, rccmFile, niuFile, planLocFile } = parse.data;
  const client = await pool.connect();

  try {
    await client.query(`
      INSERT INTO kyc_profiles (user_id, business_description, business_website, business_category, business_type, niu_number, rccm_number, signature_data, kyb_status, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        business_description = EXCLUDED.business_description,
        business_website = EXCLUDED.business_website,
        business_category = EXCLUDED.business_category,
        business_type = EXCLUDED.business_type,
        niu_number = EXCLUDED.niu_number,
        rccm_number = EXCLUDED.rccm_number,
        signature_data = EXCLUDED.signature_data,
        kyb_status = 'PENDING',
        updated_at = NOW()
    `, [req.userId, businessDescription, businessWebsite, businessCategory, businessType, niuNumber, rccmNumber, signatureData]);

    const kybDocs: Array<[string, typeof statutsFile]> = [
      ["KYB_STATUTS",  statutsFile],
      ["KYB_RCCM",     rccmFile],
      ["KYB_NIU",      niuFile],
      ["KYB_PLAN_LOC", planLocFile],
    ];

    for (const [docTypeKey, file] of kybDocs) {
      if (!file) continue;
      const existing = await db.select({ id: kycDocumentsTable.id })
        .from(kycDocumentsTable)
        .where(and(eq(kycDocumentsTable.userId, req.userId!), eq(kycDocumentsTable.type, docTypeKey)))
        .limit(1);

      if (existing.length > 0) {
        await db.update(kycDocumentsTable)
          .set({ fileName: file.name, fileData: file.data, status: "PENDING", updatedAt: new Date() })
          .where(eq(kycDocumentsTable.id, existing[0].id));
      } else {
        await db.insert(kycDocumentsTable)
          .values({ userId: req.userId!, type: docTypeKey, fileName: file.name, fileData: file.data, status: "PENDING" });
      }
    }

    req.log.info({ userId: req.userId }, "KYB submitted");
    res.json({ success: true, message: "Informations d'entreprise enregistrées" });
  } catch (err) {
    req.log.error({ err }, "KYB error");
    res.status(500).json({ error: "InternalError", message: "Erreur lors de l'enregistrement" });
  } finally {
    client.release();
  }
});

// DELETE /kyc/:id — delete a document
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "ValidationError", message: "ID invalide" });
    return;
  }

  try {
    const [doc] = await db.select().from(kycDocumentsTable)
      .where(and(eq(kycDocumentsTable.id, id), eq(kycDocumentsTable.userId, req.userId!)))
      .limit(1);

    if (!doc) {
      res.status(404).json({ error: "NotFound", message: "Document introuvable" });
      return;
    }

    if (doc.status === "VERIFIED") {
      res.status(400).json({ error: "Forbidden", message: "Impossible de supprimer un document vérifié" });
      return;
    }

    await db.delete(kycDocumentsTable).where(eq(kycDocumentsTable.id, id));
    res.json({ success: true, message: "Document supprimé" });
  } catch (err) {
    req.log.error({ err }, "KYC delete error");
    res.status(500).json({ error: "InternalError", message: "Failed to delete document" });
  }
});

export default router;
