import { pool } from "@workspace/db";

/** Reserves a withdrawal exactly once and never permits a negative balance. */
export async function reserveWithdrawal(
  transactionId: number,
  walletId: number,
  amount: number,
): Promise<boolean> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [transactions] = await conn.query<any[]>(
      "SELECT status FROM transactions WHERE id=? FOR UPDATE",
      [transactionId],
    );
    if (!transactions[0] || transactions[0].status !== "PENDING") {
      await conn.rollback();
      return false;
    }
    const [ledger] = await conn.query<any>(
      "INSERT IGNORE INTO wallet_ledger (transaction_id, wallet_id, movement_type, amount) VALUES (?,?,?,?)",
      [transactionId, walletId, "RESERVATION", amount],
    );
    if (ledger.affectedRows === 0) {
      await conn.commit();
      return true;
    }
    const [debit] = await conn.query<any>(
      "UPDATE wallets SET balance=balance-?, updated_at=NOW() WHERE id=? AND balance>=?",
      [amount, walletId, amount],
    );
    if (debit.affectedRows === 0) {
      throw new Error("Insufficient country-wallet balance");
    }
    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Finalizes a provider transaction and its single wallet movement atomically. */
export async function settleProviderTransaction(transactionId: number, status: "SUCCESS" | "FAILED"): Promise<boolean> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query<any[]>("SELECT * FROM transactions WHERE id=? FOR UPDATE", [transactionId]);
    const tx = rows[0];
    if (!tx || tx.status !== "PENDING") { await conn.rollback(); return false; }
    const country = tx.currency === "USDT" ? "ZZ" : tx.country;
    if (!country) throw new Error("Cannot settle fiat transaction without a country");
    const movement = status === "SUCCESS" && (tx.type === "DEPOSIT" || tx.type === "CARD_DEPOSIT") ? "CREDIT"
      : status === "FAILED" && tx.type === "WITHDRAWAL" ? "REFUND" : null;
    if (movement) {
      const [wallets] = await conn.query<any[]>("SELECT id FROM wallets WHERE user_id=? AND currency=? AND country=? FOR UPDATE", [tx.user_id, tx.currency, country]);
      if (!wallets[0]) throw new Error("Country wallet missing during settlement");
      const amount = movement === "CREDIT" ? Number(tx.net_amount) : Number(tx.net_amount) + Number(tx.fee);
      const [ledger] = await conn.query<any>("INSERT IGNORE INTO wallet_ledger (transaction_id, wallet_id, movement_type, amount) VALUES (?,?,?,?)", [tx.id, wallets[0].id, movement, amount]);
      if (ledger.affectedRows > 0) await conn.query("UPDATE wallets SET balance=balance+?, updated_at=NOW() WHERE id=?", [amount, wallets[0].id]);
    }
    await conn.query("UPDATE transactions SET status=?, updated_at=NOW() WHERE id=? AND status='PENDING'", [status, tx.id]);
    await conn.commit(); return true;
  } catch (err) { await conn.rollback(); throw err; } finally { conn.release(); }
}