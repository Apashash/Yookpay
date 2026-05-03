import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

function getConnectionString(): string {
  const url = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "SUPABASE_DATABASE_URL must be set. Add it in Plesk > Node.js > Environment Variables."
    );
  }
  return url;
}

let _pool: pg.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getPool(): pg.Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: getConnectionString(),
      ssl: { rejectUnauthorized: false },
    });
  }
  return _pool;
}

function getDb(): ReturnType<typeof drizzle> {
  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}

export const pool = new Proxy({} as pg.Pool, {
  get(_target, prop) {
    return (getPool() as any)[prop];
  },
});

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});

export * from "./schema";
