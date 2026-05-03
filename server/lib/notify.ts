import { pool } from "@workspace/db";

export async function createNotification(
  userId: number,
  type: "DEPOSIT" | "WITHDRAWAL" | "PAYMENT_LINK" | "EXCHANGE" | "SYSTEM",
  title: string,
  body: string,
  transactionId?: number | null,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, transaction_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, title, body, transactionId ?? null],
    );
  } catch {
    // Non-blocking: notification failure must never break a transaction
  }
}
