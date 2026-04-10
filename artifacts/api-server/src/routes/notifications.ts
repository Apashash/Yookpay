import { Router } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/authMiddleware";

const router = Router();

// Auto-delete notifications older than 24h and return remaining ones
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Auto-purge old notifications (>24h)
    await pool.query(
      `DELETE FROM notifications WHERE user_id = $1 AND created_at < NOW() - INTERVAL '24 hours'`,
      [req.userId],
    );

    const result = await pool.query(
      `SELECT id, type, title, body, transaction_id, read_at, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.userId],
    );

    const notifications = result.rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      transactionId: r.transaction_id,
      readAt: r.read_at,
      createdAt: r.created_at,
      unread: r.read_at === null,
    }));

    const unreadCount = notifications.filter((n) => n.unread).length;

    res.json({ notifications, unreadCount });
  } catch (err) {
    req.log?.error({ err }, "GET /notifications error");
    res.status(500).json({ error: "InternalError" });
  }
});

// Mark single notification as read
router.patch("/:id/read", authMiddleware, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    await pool.query(
      `UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2`,
      [id, req.userId],
    );
    res.json({ ok: true });
  } catch (err) {
    req.log?.error({ err }, "PATCH /notifications/:id/read error");
    res.status(500).json({ error: "InternalError" });
  }
});

// Delete single notification
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    await pool.query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
      [id, req.userId],
    );
    res.json({ ok: true });
  } catch (err) {
    req.log?.error({ err }, "DELETE /notifications/:id error");
    res.status(500).json({ error: "InternalError" });
  }
});

// Delete all notifications for the user
router.delete("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    await pool.query(`DELETE FROM notifications WHERE user_id = $1`, [req.userId]);
    res.json({ ok: true });
  } catch (err) {
    req.log?.error({ err }, "DELETE /notifications error");
    res.status(500).json({ error: "InternalError" });
  }
});

export default router;
