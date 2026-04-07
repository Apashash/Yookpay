import { pool } from "@workspace/db";
import pino from "pino";

const logger = pino({ level: "info" });

const ADMIN_EMAILS = ["Mfouapon0237@gmail.com"];

export async function runStartupMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    // 1. Ensure role and status columns exist (idempotent)
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'USER'
    `);
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
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

    // 3. Create conversion_fees table (platform-wide exchange settings)
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversion_fees (
        id SERIAL PRIMARY KEY,
        pair VARCHAR(10) NOT NULL UNIQUE,
        rate NUMERIC(6, 4) NOT NULL DEFAULT 0.0190,
        min_amount INTEGER NOT NULL DEFAULT 1000,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // Seed default conversion fee rows if absent
    await client.query(`
      INSERT INTO conversion_fees (pair, rate, min_amount)
      VALUES ('XAF:XOF', 0.0190, 1000),
             ('XAF:CDF', 0.0190, 1000),
             ('XOF:CDF', 0.0190, 1000)
      ON CONFLICT (pair) DO NOTHING
    `);

    // 5. Add pix_transaction_id column to transactions (for PixPay ID)
    await client.query(`
      ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS pix_transaction_id VARCHAR(100)
    `);

    // 6. Create pixpay_services table (service_id per operator+country+currency+type)
    await client.query(`
      CREATE TABLE IF NOT EXISTS pixpay_services (
        id SERIAL PRIMARY KEY,
        operator VARCHAR(30) NOT NULL,
        country VARCHAR(5),
        currency VARCHAR(10) NOT NULL,
        type VARCHAR(20) NOT NULL,
        service_id INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT true,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(operator, country, currency, type)
      )
    `);

    // 6b. Add country column to pixpay_services if table already existed without it
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pixpay_services')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pixpay_services' AND column_name = 'country') THEN
          ALTER TABLE pixpay_services ADD COLUMN country VARCHAR(5);
          ALTER TABLE pixpay_services DROP CONSTRAINT IF EXISTS pixpay_services_operator_currency_type_key;
          ALTER TABLE pixpay_services ADD CONSTRAINT pixpay_services_operator_country_currency_type_key UNIQUE(operator, country, currency, type);
        END IF;
      END$$
    `);

    // 7. Create platform_config table (key-value for Wave business_name_id, etc.)
    await client.query(`
      CREATE TABLE IF NOT EXISTS platform_config (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // 8. Set admin roles for designated emails
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
