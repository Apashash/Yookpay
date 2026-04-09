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

    // 6c. Ensure unique constraint name is consistent
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'pixpay_services'
            AND constraint_name = 'pixpay_services_uq'
        ) THEN
          ALTER TABLE pixpay_services DROP CONSTRAINT IF EXISTS pixpay_services_operator_currency_type_key;
          ALTER TABLE pixpay_services DROP CONSTRAINT IF EXISTS pixpay_services_operator_country_currency_type_key;
          ALTER TABLE pixpay_services ADD CONSTRAINT pixpay_services_uq UNIQUE(operator, country, currency, type);
        END IF;
      END$$
    `);

    // 6d. Seed all PixPay service IDs (ON CONFLICT DO NOTHING — preserves manual overrides)
    await client.query(`
      INSERT INTO pixpay_services (operator, country, currency, type, service_id, active, notes) VALUES
        -- XOF — Côte d'Ivoire (CI)
        -- CASH OUT = collection/dépôt, CASH IN = décaissement/retrait (terminologie PixPay)
        ('ORANGE',   'CI', 'XOF', 'DEPOSIT',    1,   true, 'OM_CI CASH OUT'),
        ('ORANGE',   'CI', 'XOF', 'WITHDRAWAL', 2,   true, 'OM_CI CASH IN'),
        ('MOOV',     'CI', 'XOF', 'DEPOSIT',    3,   true, 'MOOV_CI CASH OUT'),
        ('MOOV',     'CI', 'XOF', 'WITHDRAWAL', 4,   true, 'MOOV_CI CASH IN'),
        ('MTN',      'CI', 'XOF', 'DEPOSIT',    5,   true, 'MTN_CI CASH OUT'),
        ('MTN',      'CI', 'XOF', 'WITHDRAWAL', 6,   true, 'MTN_CI CASH IN'),
        ('WAVE',     'CI', 'XOF', 'DEPOSIT',    7,   true, 'WAVE_CI CASH OUT'),
        ('WAVE',     'CI', 'XOF', 'WITHDRAWAL', 8,   true, 'WAVE_CI CASH IN'),
        -- XOF — Sénégal (SN)
        ('WAVE',     'SN', 'XOF', 'DEPOSIT',    211, true, 'WAVE_SN CASH OUT'),
        ('WAVE',     'SN', 'XOF', 'WITHDRAWAL', 210, true, 'WAVE_SN CASH IN'),
        ('ORANGE',   'SN', 'XOF', 'DEPOSIT',    213, true, 'OM_SN CASH OUT'),
        ('ORANGE',   'SN', 'XOF', 'WITHDRAWAL', 214, true, 'OM_SN CASH IN'),
        ('FREE',     'SN', 'XOF', 'DEPOSIT',    341, true, 'MIX_SN CASH OUT'),
        ('FREE',     'SN', 'XOF', 'WITHDRAWAL', 340, true, 'MIX_SN CASH IN'),
        -- XOF — Burkina Faso (BF)
        ('MOOV',     'BF', 'XOF', 'DEPOSIT',    239, true, 'MOOV_BF CASH OUT'),
        ('MOOV',     'BF', 'XOF', 'WITHDRAWAL', 238, true, 'MOOV_BF CASH IN'),
        ('ORANGE',   'BF', 'XOF', 'DEPOSIT',    241, true, 'ORANGE_BF CASH OUT'),
        ('ORANGE',   'BF', 'XOF', 'WITHDRAWAL', 240, true, 'ORANGE_BF CASH IN'),
        -- XAF — Cameroun (CM)
        ('ORANGE',   'CM', 'XAF', 'DEPOSIT',    337, true, 'ORANGE_CM CASH OUT'),
        ('ORANGE',   'CM', 'XAF', 'WITHDRAWAL', 336, true, 'ORANGE_CM CASH IN'),
        ('MTN',      'CM', 'XAF', 'DEPOSIT',    339, true, 'MTN_CM CASH OUT'),
        ('MTN',      'CM', 'XAF', 'WITHDRAWAL', 338, true, 'MTN_CM CASH IN'),
        -- CDF — Congo RDC (CD)
        ('VODACOM',  'CD', 'CDF', 'DEPOSIT',    343, true, 'MPESA_CD CASH OUT'),
        ('VODACOM',  'CD', 'CDF', 'WITHDRAWAL', 342, true, 'MPESA_CD CASH IN'),
        ('AIRTEL',   'CD', 'CDF', 'DEPOSIT',    345, true, 'AIRTEL_CD CASH OUT'),
        ('AIRTEL',   'CD', 'CDF', 'WITHDRAWAL', 344, true, 'AIRTEL_CD CASH IN'),
        ('ORANGE',   'CD', 'CDF', 'DEPOSIT',    347, true, 'ORANGE_CD CASH OUT'),
        ('ORANGE',   'CD', 'CDF', 'WITHDRAWAL', 346, true, 'ORANGE_CD CASH IN'),
        ('AFRICELL', 'CD', 'CDF', 'DEPOSIT',    349, true, 'AFRIMONEY_CD CASH OUT'),
        ('AFRICELL', 'CD', 'CDF', 'WITHDRAWAL', 348, true, 'AFRIMONEY_CD CASH IN')
      ON CONFLICT ON CONSTRAINT pixpay_services_uq
      DO UPDATE SET service_id = EXCLUDED.service_id, notes = EXCLUDED.notes, updated_at = NOW()
    `);

    // 7b. Create kyc_profiles table (structured KYC identity + KYB business info)
    await client.query(`
      CREATE TABLE IF NOT EXISTS kyc_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        full_name VARCHAR(255),
        date_of_birth DATE,
        doc_type VARCHAR(30),
        doc_number VARCHAR(100),
        kyc_status VARCHAR(20) NOT NULL DEFAULT 'NOT_STARTED',
        business_description TEXT,
        business_website VARCHAR(500),
        business_category VARCHAR(200),
        business_type VARCHAR(50),
        signature_data TEXT,
        niu_number VARCHAR(100),
        rccm_number VARCHAR(100),
        kyb_status VARCHAR(20) NOT NULL DEFAULT 'NOT_STARTED',
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // 7c. Add niu_number / rccm_number to existing kyc_profiles (idempotent)
    await client.query(`ALTER TABLE kyc_profiles ADD COLUMN IF NOT EXISTS niu_number VARCHAR(100)`);
    await client.query(`ALTER TABLE kyc_profiles ADD COLUMN IF NOT EXISTS rccm_number VARCHAR(100)`);

    // 7. Create platform_config table (key-value for Wave business_name_id, etc.)
    await client.query(`
      CREATE TABLE IF NOT EXISTS platform_config (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // 8a. Add locked_balance column to wallets (for USDT exchange lock)
    await client.query(`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS locked_balance DECIMAL(18,2) NOT NULL DEFAULT 0`);

    // 8b. Create USDT wallets for all existing users that don't have one
    await client.query(`
      INSERT INTO wallets (user_id, currency, balance, locked_balance, country)
      SELECT u.id, 'USDT', 0, 0, 'ZZ'
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM wallets w WHERE w.user_id = u.id AND w.currency = 'USDT'
      )
    `);

    // 8c. Create crypto_exchanges table
    await client.query(`
      CREATE TABLE IF NOT EXISTS crypto_exchanges (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        from_currency VARCHAR(10) NOT NULL,
        to_currency VARCHAR(10) NOT NULL,
        from_amount DECIMAL(18,2) NOT NULL,
        usdt_amount DECIMAL(18,8) NOT NULL,
        to_amount DECIMAL(18,2),
        exchange_rate DECIMAL(18,8) NOT NULL,
        fee_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
        status VARCHAR(30) NOT NULL DEFAULT 'STEP1_DONE',
        tx_step1_id INTEGER REFERENCES transactions(id),
        tx_step2_id INTEGER REFERENCES transactions(id),
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // 9. Create usdt_rates table for admin-defined USDT exchange rates
    await client.query(`
      CREATE TABLE IF NOT EXISTS usdt_rates (
        pair VARCHAR(20) PRIMARY KEY,
        rate DECIMAL(20,8) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    const usdtPairs = ["USDT_XAF","XAF_USDT","USDT_XOF","XOF_USDT","USDT_CDF","CDF_USDT","EXCHANGE_FEE"];
    for (const pair of usdtPairs) {
      await client.query(`INSERT INTO usdt_rates (pair, rate) VALUES ($1, 0) ON CONFLICT (pair) DO NOTHING`, [pair]);
    }

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

    // 11. Add yookpay_margin column to transactions (stores YookPay profit only, separate from PixPay fee)
    await client.query(`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS yookpay_margin NUMERIC(18,4) DEFAULT 0
    `);
    // Backfill existing transactions using known PixPay base rates
    await client.query(`
      UPDATE transactions SET yookpay_margin = GREATEST(
        CASE
          WHEN type IN ('DEPOSIT','WITHDRAWAL') AND country IN ('CM','CG','GA')
            THEN fee::numeric - amount::numeric * 0.015
          WHEN type IN ('DEPOSIT','WITHDRAWAL') AND country IN ('CI','SN','BF','BJ','GM','GN','ML','TG')
            THEN fee::numeric - amount::numeric * 0.019
          WHEN type = 'DEPOSIT'    AND country = 'CD'
            THEN fee::numeric - amount::numeric * 0.030
          WHEN type = 'WITHDRAWAL' AND country = 'CD'
            THEN fee::numeric - amount::numeric * 0.035
          ELSE 0
        END, 0
      )
      WHERE (yookpay_margin IS NULL OR yookpay_margin = 0)
        AND status = 'SUCCESS'
        AND type IN ('DEPOSIT','WITHDRAWAL')
    `);

    // 10. Create user_operator_fees table (PixPay fee + YookPay margin per user/country/operator)
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_operator_fees (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        country VARCHAR(2) NOT NULL,
        operator VARCHAR(20) NOT NULL,
        pixpay_deposit NUMERIC(6,4) NOT NULL,
        pixpay_withdrawal NUMERIC(6,4) NOT NULL,
        margin_deposit NUMERIC(6,4) NOT NULL DEFAULT 0.015,
        margin_withdrawal NUMERIC(6,4) NOT NULL DEFAULT 0.015,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(user_id, country, operator)
      )
    `);

    logger.info("Startup migrations completed successfully");
  } catch (err) {
    logger.error({ err }, "Startup migration error");
    // Don't crash the server — migrations are best-effort
  } finally {
    client.release();
  }
}
