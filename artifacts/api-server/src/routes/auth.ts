import { Router } from "express";
import bcrypt from "bcrypt";
import { db } from "@workspace/db";
import { usersTable, walletsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authMiddleware, signToken, type AuthRequest } from "../middlewares/authMiddleware";
import { authRateLimit } from "../middlewares/rateLimitMiddleware";
import { z } from "zod";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  phone: z.string().min(6, "Numéro invalide"),
  country: z.enum(["CM", "SN", "CD", "BJ", "BF", "CG", "CI", "GA", "GM", "GN", "ML", "TG"]),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/register", authRateLimit, async (req, res) => {
  const parse = registerSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: "Invalid registration data" });
    return;
  }

  const { email, password, name, phone, country } = parse.data;

  try {
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "Conflict", message: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db
      .insert(usersTable)
      .values({ email, passwordHash, name, phone, country })
      .returning();

    // Create wallets for all three currencies
    await db.insert(walletsTable).values([
      { userId: user.id, currency: "XAF", balance: "0", country: "CM" },
      { userId: user.id, currency: "XOF", balance: "0", country: "SN" },
      { userId: user.id, currency: "CDF", balance: "0", country: "CD" },
    ]);

    const token = signToken(user.id);
    req.log.info({ userId: user.id, email: user.email }, "User registered");

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone ?? null,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Registration error");
    res.status(500).json({ error: "InternalError", message: "Registration failed" });
  }
});

router.post("/login", authRateLimit, async (req, res) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: "Invalid credentials format" });
    return;
  }

  const { email, password } = parse.data;

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      req.log.warn({ email }, "Failed login attempt");
      res.status(401).json({ error: "Unauthorized", message: "Invalid email or password" });
      return;
    }

    const token = signToken(user.id);
    req.log.info({ userId: user.id }, "User logged in");

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone ?? null,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "InternalError", message: "Login failed" });
  }
});

router.get("/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.userId!))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "NotFound", message: "User not found" });
      return;
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone ?? null,
      country: user.country ?? null,
      createdAt: user.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Get me error");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch user" });
  }
});

// PUT /auth/password — change password
router.put("/password", authMiddleware, async (req: AuthRequest, res) => {
  const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, "Le nouveau mot de passe doit comporter au moins 8 caractères"),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: parse.error.errors[0]?.message ?? "Données invalides" });
    return;
  }

  const { currentPassword, newPassword } = parse.data;

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user) {
      res.status(404).json({ error: "NotFound", message: "Utilisateur introuvable" });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Unauthorized", message: "Mot de passe actuel incorrect" });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, req.userId!));

    req.log.info({ userId: req.userId }, "Password changed");
    res.json({ success: true, message: "Mot de passe mis à jour avec succès" });
  } catch (err) {
    req.log.error({ err }, "Password change error");
    res.status(500).json({ error: "InternalError", message: "Échec de la mise à jour du mot de passe" });
  }
});

// DELETE /auth/account — delete account
router.delete("/account", authMiddleware, async (req: AuthRequest, res) => {
  const schema = z.object({
    password: z.string().min(1, "Mot de passe requis pour confirmer la suppression"),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "ValidationError", message: "Mot de passe requis" });
    return;
  }

  const { password } = parse.data;

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user) {
      res.status(404).json({ error: "NotFound", message: "Utilisateur introuvable" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Unauthorized", message: "Mot de passe incorrect" });
      return;
    }

    await db.delete(usersTable).where(eq(usersTable.id, req.userId!));

    req.log.info({ userId: req.userId }, "Account deleted");
    res.json({ success: true, message: "Compte supprimé avec succès" });
  } catch (err) {
    req.log.error({ err }, "Account deletion error");
    res.status(500).json({ error: "InternalError", message: "Échec de la suppression du compte" });
  }
});

export default router;
