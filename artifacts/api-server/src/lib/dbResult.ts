/**
 * drizzle-orm/mysql2 UPDATE/DELETE/INSERT results are `[ResultSetHeader, ...]`.
 * Returns the number of affected rows (0 if unknown shape).
 */
export function affectedRows(result: unknown): number {
  if (Array.isArray(result)) return Number((result[0] as { affectedRows?: number })?.affectedRows ?? 0);
  return Number((result as { affectedRows?: number })?.affectedRows ?? 0);
}
