import { Router } from "express";
import { db } from "@workspace/db";
import { kycDocumentsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/authMiddleware";
import { z } from "zod";

const router = Router();

const DOC_TYPES = ["CNI", "PASSEPORT", "RCCM", "JUSTIF_DOMICILE", "PHOTO_SELFIE"] as const;
type DocType = typeof DOC_TYPES[number];

// GET /kyc — get all KYC documents for user
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
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

    const submitted = docs.map((d) => d.type);
    const missing = DOC_TYPES.filter((t) => !submitted.includes(t));

    const allVerified = DOC_TYPES.every((t) =>
      docs.find((d) => d.type === t && d.status === "VERIFIED")
    );

    res.json({
      documents: docs,
      kycStatus: allVerified ? "VERIFIED" : docs.length > 0 ? "PENDING" : "NOT_STARTED",
      missingDocuments: missing,
    });
  } catch (err) {
    req.log.error({ err }, "Get KYC error");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch KYC documents" });
  }
});

// POST /kyc — upload a document
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  const schema = z.object({
    type: z.enum(DOC_TYPES),
    fileName: z.string().min(1).max(255),
    fileData: z.string().min(1),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: "Données invalides" });
    return;
  }

  const { type, fileName, fileData } = parse.data;

  try {
    const existing = await db
      .select({ id: kycDocumentsTable.id })
      .from(kycDocumentsTable)
      .where(and(eq(kycDocumentsTable.userId, req.userId!), eq(kycDocumentsTable.type, type)))
      .limit(1);

    let doc;
    if (existing.length > 0) {
      const [updated] = await db
        .update(kycDocumentsTable)
        .set({ fileName, fileData, status: "PENDING", updatedAt: new Date() })
        .where(eq(kycDocumentsTable.id, existing[0].id))
        .returning({
          id: kycDocumentsTable.id,
          type: kycDocumentsTable.type,
          status: kycDocumentsTable.status,
          fileName: kycDocumentsTable.fileName,
          createdAt: kycDocumentsTable.createdAt,
          updatedAt: kycDocumentsTable.updatedAt,
        });
      doc = updated;
    } else {
      const [inserted] = await db
        .insert(kycDocumentsTable)
        .values({ userId: req.userId!, type, fileName, fileData, status: "PENDING" })
        .returning({
          id: kycDocumentsTable.id,
          type: kycDocumentsTable.type,
          status: kycDocumentsTable.status,
          fileName: kycDocumentsTable.fileName,
          createdAt: kycDocumentsTable.createdAt,
          updatedAt: kycDocumentsTable.updatedAt,
        });
      doc = inserted;
    }

    req.log.info({ userId: req.userId, docId: doc.id, type }, "KYC document uploaded");
    res.status(201).json({ document: doc, message: "Document soumis avec succès" });
  } catch (err) {
    req.log.error({ err }, "KYC upload error");
    res.status(500).json({ error: "InternalError", message: "Failed to upload document" });
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
    const [doc] = await db
      .select()
      .from(kycDocumentsTable)
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
