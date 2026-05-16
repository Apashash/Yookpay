import { Router } from "express";
import { db } from "@workspace/db";
import { apiKeysTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/authMiddleware";
import { createHash, randomBytes } from "crypto";
import { z } from "zod";

const router = Router();

const KEY_TYPE_SCHEMA = z.enum(["payin", "payout"]);
type KeyType = "payin" | "payout";

function generateKey(type: KeyType): { raw: string; hash: string; prefix: string } {
  const tag = type === "payin" ? "IN" : "OUT";
  const raw = `YKP_${tag}_${randomBytes(24).toString("hex")}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 16);
  return { raw, hash, prefix };
}

function formatKey(k: typeof apiKeysTable.$inferSelect) {
  return {
    id: k.id,
    name: k.name,
    prefix: k.keyPrefix,
    keyType: k.keyType as KeyType,
    active: k.active,
    lastUsedAt: k.lastUsedAt,
    createdAt: k.createdAt,
  };
}

// GET /api-keys — list all active keys for user
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const keys = await db
      .select()
      .from(apiKeysTable)
      .where(and(eq(apiKeysTable.userId, req.userId!), eq(apiKeysTable.active, true)));

    res.json({ keys: keys.map(formatKey) });
  } catch (err) {
    req.log.error({ err }, "List API keys error");
    res.status(500).json({ error: "InternalError", message: "Failed to list keys" });
  }
});

// POST /api-keys — generate a new key (1 payin + 1 payout max per account)
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(1).max(100).optional(),
    type: KEY_TYPE_SCHEMA.default("payin"),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: parse.error.errors[0]?.message });
    return;
  }
  const { type } = parse.data;
  const name = parse.data.name ?? (type === "payin" ? "Clé Payin" : "Clé Payout");

  try {
    const existing = await db
      .select({ id: apiKeysTable.id })
      .from(apiKeysTable)
      .where(
        and(
          eq(apiKeysTable.userId, req.userId!),
          eq(apiKeysTable.active, true),
          eq(apiKeysTable.keyType, type),
        )
      );

    if (existing.length >= 1) {
      res.status(400).json({
        error: "LimitReached",
        message: `Vous avez déjà une clé ${type} active. Révoquez-la avant d'en créer une nouvelle.`,
      });
      return;
    }

    const { raw, hash, prefix } = generateKey(type);

    const [key] = await db
      .insert(apiKeysTable)
      .values({ userId: req.userId!, keyHash: hash, keyPrefix: prefix, name, keyType: type })
      .returning();

    req.log.info({ userId: req.userId, keyId: key!.id, type }, "API key created");

    res.status(201).json({
      id: key!.id,
      name: key!.name,
      prefix: key!.keyPrefix,
      keyType: key!.keyType,
      rawKey: raw,
      createdAt: key!.createdAt,
      message: "Conservez cette clé en lieu sûr — elle ne sera plus affichée.",
    });
  } catch (err) {
    req.log.error({ err }, "Create API key error");
    res.status(500).json({ error: "InternalError", message: "Failed to create key" });
  }
});

// GET /api-keys/:id — get a single key (no raw key)
router.get("/:id", authMiddleware, async (req: AuthRequest, res) => {
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
    res.json(formatKey(key));
  } catch (err) {
    req.log.error({ err }, "Get API key error");
    res.status(500).json({ error: "InternalError", message: "Failed to get key" });
  }
});

// POST /api-keys/:id/regenerate — revoke old key, create new one of same type
router.post("/:id/regenerate", authMiddleware, async (req: AuthRequest, res) => {
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

    if (!key || !key.active) {
      res.status(404).json({ error: "NotFound", message: "Clé introuvable ou déjà révoquée" });
      return;
    }

    await db.update(apiKeysTable).set({ active: false }).where(eq(apiKeysTable.id, id));

    const type = (key.keyType ?? "payin") as KeyType;
    const { raw, hash, prefix } = generateKey(type);
    const [newKey] = await db
      .insert(apiKeysTable)
      .values({ userId: req.userId!, keyHash: hash, keyPrefix: prefix, name: key.name, keyType: type })
      .returning();

    req.log.info({ userId: req.userId, oldKeyId: id, newKeyId: newKey!.id }, "API key regenerated");

    res.status(201).json({
      id: newKey!.id,
      name: newKey!.name,
      prefix: newKey!.keyPrefix,
      keyType: newKey!.keyType,
      rawKey: raw,
      createdAt: newKey!.createdAt,
      message: "Ancienne clé révoquée. Conservez la nouvelle en lieu sûr.",
    });
  } catch (err) {
    req.log.error({ err }, "Regenerate API key error");
    res.status(500).json({ error: "InternalError", message: "Failed to regenerate key" });
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

    await db.update(apiKeysTable).set({ active: false }).where(eq(apiKeysTable.id, id));

    req.log.info({ userId: req.userId, keyId: id }, "API key revoked");
    res.json({ success: true, message: "Clé révoquée avec succès" });
  } catch (err) {
    req.log.error({ err }, "Revoke API key error");
    res.status(500).json({ error: "InternalError", message: "Failed to revoke key" });
  }
});

export default router;
