import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

// Public — no auth required (used by landing page and floating button)
router.get("/", async (_req, res) => {
  try {
    const r = await pool.query(
      "SELECT whatsapp_url, facebook_url, telegram_url, phone_url FROM support_links WHERE id = 1"
    );
    res.json(r.rows[0] ?? { whatsapp_url: "", facebook_url: "", telegram_url: "", phone_url: "" });
  } catch {
    res.status(500).json({ error: "InternalError" });
  }
});

export default router;
