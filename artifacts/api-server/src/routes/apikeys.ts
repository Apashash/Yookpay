import { Router } from "express";
import { db } from "@workspace/db";
import { apiKeysTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/authMiddleware";
import { createHash, randomBytes } from "crypto";
import { z } from "zod";

const router = Router();

function generateKey(): { raw: string; hash: string; prefix: string } {
  const raw = `YKP_LIVE_${randomBytes(24).toString("hex")}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 16);
  return { raw, hash, prefix };
}

// GET /api-keys — list all keys for user (no raw key)
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const keys = await db
      .select()
      .from(apiKeysTable)
      .where(eq(apiKeysTable.userId, req.userId!));

    res.json({
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.keyPrefix,
        active: k.active,
        lastUsedAt: k.lastUsedAt,
        createdAt: k.createdAt,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "List API keys error");
    res.status(500).json({ error: "InternalError", message: "Failed to list keys" });
  }
});

// POST /api-keys — generate a new key
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  const schema = z.object({ name: z.string().min(1).max(100).default("Clé principale") });
  const parse = schema.safeParse(req.body);
  const name = parse.success ? parse.data.name : "Clé principale";

  try {
    const existing = await db
      .select({ id: apiKeysTable.id })
      .from(apiKeysTable)
      .where(and(eq(apiKeysTable.userId, req.userId!), eq(apiKeysTable.active, true)));

    if (existing.length >= 3) {
      res.status(400).json({ error: "LimitReached", message: "Maximum 3 clés API actives par compte" });
      return;
    }

    const { raw, hash, prefix } = generateKey();

    const [key] = await db
      .insert(apiKeysTable)
      .values({ userId: req.userId!, keyHash: hash, keyPrefix: prefix, name })
      .returning();

    req.log.info({ userId: req.userId, keyId: key.id }, "API key created");

    res.status(201).json({
      id: key.id,
      name: key.name,
      prefix: key.keyPrefix,
      rawKey: raw,
      createdAt: key.createdAt,
      message: "Conservez cette clé en lieu sûr — elle ne sera plus affichée.",
    });
  } catch (err) {
    req.log.error({ err }, "Create API key error");
    res.status(500).json({ error: "InternalError", message: "Failed to create key" });
  }
});

// DELETE /api-keys/:id — revoke a key
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "ValidationError", message: "Invalid key ID" });
    return;
  }

  try {
    const [key] = await db
      .select()
      .from(apiKeysTable)
      .where(and(eq(apiKeysTable.id, id), eq(apiKeysTable.userId, req.userId!)))
      .limit(1);

    if (!key) {
      res.status(404).json({ error: "NotFound", message: "Clé introuvable" });
      return;
    }

    await db
      .update(apiKeysTable)
      .set({ active: false })
      .where(eq(apiKeysTable.id, id));

    req.log.info({ userId: req.userId, keyId: id }, "API key revoked");
    res.json({ success: true, message: "Clé révoquée avec succès" });
  } catch (err) {
    req.log.error({ err }, "Revoke API key error");
    res.status(500).json({ error: "InternalError", message: "Failed to revoke key" });
  }
});

export default router;
