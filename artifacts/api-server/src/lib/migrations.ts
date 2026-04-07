import { pool } from "@workspace/db";
import pino from "pino";

const logger = pino({ level: "info" });

const ADMIN_EMAILS = ["Mfouapon0237@gmail.com"];

export async function runStartupMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    // 1. Ensure role column exists (idempotent)
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'USER'
    `);

    // 2. Ensure all expected tables exist for new features
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key_hash TEXT NOT NULL,
        key_prefix VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL DEFAULT 'Clé principale',
        active BOOLEAN NOT NULL DEFAULT true,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS kyc_documents (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        file_name VARCHAR(255),
        file_data TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_fees (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        country VARCHAR(2) NOT NULL,
        operator VARCHAR(20) NOT NULL,
        transaction_type VARCHAR(20) NOT NULL,
        rate NUMERIC(6, 4) NOT NULL,
        min_fee INTEGER NOT NULL,
        max_fee INTEGER,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // 3. Set admin roles for designated emails
    for (const email of ADMIN_EMAILS) {
      const result = await client.query(
        "UPDATE users SET role = 'ADMIN' WHERE LOWER(email) = LOWER($1) AND role != 'ADMIN'",
        [email]
      );
      if (result.rowCount && result.rowCount > 0) {
        logger.info({ email }, "Admin role assigned via startup migration");
      }
    }

    logger.info("Startup migrations completed successfully");
  } catch (err) {
    logger.error({ err }, "Startup migration error");
    // Don't crash the server — migrations are best-effort
  } finally {
    client.release();
  }
}
