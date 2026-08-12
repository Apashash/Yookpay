import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const connectionString =
  process.env.MYSQL_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "[db] WARNING: MYSQL_DATABASE_URL (or DATABASE_URL) is not set. " +
    "Database queries will fail until this environment variable is configured."
  );
}

export const pool = mysql.createPool({
  uri: connectionString || "mysql://root@localhost:3306/yookpay",
  waitForConnections: true,
  connectionLimit: 10,
});

export const db = drizzle(pool, { schema, mode: "default" });

// Compatibility shim: PostgreSQL's db.execute() returned `{ rows }`, but
// drizzle-orm/mysql2 returns `[rows, fields]`. Normalize so all existing
// `result.rows` call sites keep working.
const originalExecute = db.execute.bind(db);
(db as any).execute = async (query: any) => {
  const result: any = await originalExecute(query);
  if (Array.isArray(result)) {
    const rows = result[0];
    return { rows: Array.isArray(rows) ? rows : [], raw: result };
  }
  return result;
};

/**
 * pgQuery — compatibility helper for raw SQL previously written for node-postgres.
 * Accepts `$1, $2, ...` placeholders, converts them to mysql2 `?` placeholders
 * (duplicating params when a placeholder is reused), and returns `{ rows, insertId, affectedRows }`
 * like pg's `{ rows }` shape. SQL text must already be MySQL-dialect otherwise.
 */
export async function pgQuery<T = any>(
  text: string,
  params: unknown[] = []
): Promise<{ rows: T[]; insertId: number; affectedRows: number }> {
  const mapped: unknown[] = [];
  const sqlText = text.replace(/\$(\d+)/g, (_m, n) => {
    mapped.push(params[Number(n) - 1]);
    return "?";
  });
  const [result] = await pool.query(sqlText, mapped);
  if (Array.isArray(result)) {
    return { rows: result as T[], insertId: 0, affectedRows: 0 };
  }
  const header = result as { insertId?: number; affectedRows?: number };
  return { rows: [], insertId: header.insertId ?? 0, affectedRows: header.affectedRows ?? 0 };
}

export * from "./schema";
