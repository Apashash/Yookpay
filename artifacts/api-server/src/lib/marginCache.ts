import { pool } from "@workspace/db";
import { DEFAULT_MARGIN } from "../services/feeService";

let cachedMargin: number | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60_000;

export async function getDefaultMargin(): Promise<number> {
  const now = Date.now();
  if (cachedMargin !== null && now < cacheExpiry) {
    return cachedMargin;
  }
  try {
    const result = await pool.query<{ value: string }>(
      "SELECT value FROM platform_config WHERE key = 'default_margin' LIMIT 1"
    );
    if (result.rows.length && result.rows[0].value) {
      const val = parseFloat(result.rows[0].value);
      if (!isNaN(val) && val >= 0) {
        cachedMargin = val;
        cacheExpiry = now + CACHE_TTL_MS;
        return val;
      }
    }
  } catch {
    // fallback
  }
  return DEFAULT_MARGIN;
}

export function invalidateMarginCache(): void {
  cachedMargin = null;
  cacheExpiry = 0;
}
