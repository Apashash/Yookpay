import { pool } from "@workspace/db";
import pino from "pino";

const logger = pino({ level: "info" });

const ADMIN_EMAILS = ["Mfouapon0237@gmail.com"];

export async function runStartupMigrations(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    // 1. Ensure role and status columns exist (idempotent)
    await conn.execute(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'USER'
    `);
    await conn.execute(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    `);

    // 2. Ensure api_keys table exists
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        key_hash TEXT NOT NULL,
        key_prefix VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL DEFAULT 'Clé principale',
        key_type VARCHAR(10) NOT NULL DEFAULT 'payin',
        active TINYINT(1) NOT NULL DEFAULT 1,
        last_used_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT api_keys_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await conn.execute(`
      ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_type VARCHAR(10) NOT NULL DEFAULT 'payin'
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS kyc_documents (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        file_name VARCHAR(255) DEFAULT NULL,
        file_data LONGTEXT DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT kyc_documents_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS user_fees (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        country VARCHAR(10) NOT NULL,
        operator VARCHAR(20) NOT NULL,
        transaction_type VARCHAR(20) NOT NULL,
        rate DECIMAL(6,4) NOT NULL,
        min_fee INT NOT NULL,
        max_fee INT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT user_fees_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 3. conversion_fees
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS conversion_fees (
        id INT NOT NULL AUTO_INCREMENT,
        pair VARCHAR(10) NOT NULL,
        rate DECIMAL(6,4) NOT NULL DEFAULT '0.0190',
        min_amount DECIMAL(12,0) NOT NULL DEFAULT '1000',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY conversion_fees_pair_key (pair)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Seed default conversion fee rows (INSERT IGNORE skips duplicates)
    await conn.execute(`
      INSERT IGNORE INTO conversion_fees (pair, rate, min_amount) VALUES
        ('XAF:XOF', 0.0190, 1000),
        ('XAF:CDF', 0.0190, 1000),
        ('XOF:CDF', 0.0190, 1000)
    `);

    // 5. pix_transaction_id column on transactions
    await conn.execute(`
      ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS pix_transaction_id VARCHAR(100) DEFAULT NULL
    `);

    // 6. pixpay_services
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS pixpay_services (
        id INT NOT NULL AUTO_INCREMENT,
        operator VARCHAR(30) NOT NULL,
        country VARCHAR(5) DEFAULT NULL,
        currency VARCHAR(10) NOT NULL,
        type VARCHAR(20) NOT NULL,
        service_id INT NOT NULL DEFAULT 0,
        active TINYINT(1) NOT NULL DEFAULT 1,
        notes TEXT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY pixpay_services_uq (operator, country, currency, type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 6d. Seed all PixPay service IDs
    await conn.execute(`
      INSERT INTO pixpay_services (operator, country, currency, type, service_id, active, notes) VALUES
        ('ORANGE',   'CI', 'XOF', 'DEPOSIT',    1,   1, 'OM_CI CASH OUT'),
        ('ORANGE',   'CI', 'XOF', 'WITHDRAWAL', 2,   1, 'OM_CI CASH IN'),
        ('MOOV',     'CI', 'XOF', 'DEPOSIT',    3,   1, 'MOOV_CI CASH OUT'),
        ('MOOV',     'CI', 'XOF', 'WITHDRAWAL', 4,   1, 'MOOV_CI CASH IN'),
        ('MTN',      'CI', 'XOF', 'DEPOSIT',    5,   1, 'MTN_CI CASH OUT'),
        ('MTN',      'CI', 'XOF', 'WITHDRAWAL', 6,   1, 'MTN_CI CASH IN'),
        ('WAVE',     'CI', 'XOF', 'DEPOSIT',    7,   1, 'WAVE_CI CASH OUT'),
        ('WAVE',     'CI', 'XOF', 'WITHDRAWAL', 8,   1, 'WAVE_CI CASH IN'),
        ('WAVE',     'SN', 'XOF', 'DEPOSIT',    211, 1, 'WAVE_SN CASH OUT'),
        ('WAVE',     'SN', 'XOF', 'WITHDRAWAL', 210, 1, 'WAVE_SN CASH IN'),
        ('ORANGE',   'SN', 'XOF', 'DEPOSIT',    213, 1, 'OM_SN CASH OUT'),
        ('ORANGE',   'SN', 'XOF', 'WITHDRAWAL', 214, 1, 'OM_SN CASH IN'),
        ('FREE',     'SN', 'XOF', 'DEPOSIT',    341, 1, 'MIX_SN CASH OUT'),
        ('FREE',     'SN', 'XOF', 'WITHDRAWAL', 340, 1, 'MIX_SN CASH IN'),
        ('MOOV',     'BF', 'XOF', 'DEPOSIT',    239, 1, 'MOOV_BF CASH OUT'),
        ('MOOV',     'BF', 'XOF', 'WITHDRAWAL', 238, 1, 'MOOV_BF CASH IN'),
        ('ORANGE',   'BF', 'XOF', 'DEPOSIT',    241, 1, 'ORANGE_BF CASH OUT'),
        ('ORANGE',   'BF', 'XOF', 'WITHDRAWAL', 240, 1, 'ORANGE_BF CASH IN'),
        ('ORANGE',   'CM', 'XAF', 'DEPOSIT',    337, 1, 'ORANGE_CM CASH OUT'),
        ('ORANGE',   'CM', 'XAF', 'WITHDRAWAL', 336, 1, 'ORANGE_CM CASH IN'),
        ('MTN',      'CM', 'XAF', 'DEPOSIT',    339, 1, 'MTN_CM CASH OUT'),
        ('MTN',      'CM', 'XAF', 'WITHDRAWAL', 338, 1, 'MTN_CM CASH IN'),
        ('VODACOM',  'CD', 'CDF', 'DEPOSIT',    343, 1, 'MPESA_CD CASH OUT'),
        ('VODACOM',  'CD', 'CDF', 'WITHDRAWAL', 342, 1, 'MPESA_CD CASH IN'),
        ('AIRTEL',   'CD', 'CDF', 'DEPOSIT',    345, 1, 'AIRTEL_CD CASH OUT'),
        ('AIRTEL',   'CD', 'CDF', 'WITHDRAWAL', 344, 1, 'AIRTEL_CD CASH IN'),
        ('ORANGE',   'CD', 'CDF', 'DEPOSIT',    347, 1, 'ORANGE_CD CASH OUT'),
        ('ORANGE',   'CD', 'CDF', 'WITHDRAWAL', 346, 1, 'ORANGE_CD CASH IN'),
        ('AFRICELL', 'CD', 'CDF', 'DEPOSIT',    349, 1, 'AFRIMONEY_CD CASH OUT'),
        ('AFRICELL', 'CD', 'CDF', 'WITHDRAWAL', 348, 1, 'AFRIMONEY_CD CASH IN')
      ON DUPLICATE KEY UPDATE
        service_id = VALUES(service_id),
        notes = VALUES(notes),
        updated_at = CURRENT_TIMESTAMP
    `);

    // 7b. kyc_profiles
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS kyc_profiles (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        full_name VARCHAR(255) DEFAULT NULL,
        date_of_birth DATE DEFAULT NULL,
        doc_type VARCHAR(30) DEFAULT NULL,
        doc_number VARCHAR(100) DEFAULT NULL,
        kyc_status VARCHAR(20) NOT NULL DEFAULT 'NOT_STARTED',
        business_description TEXT DEFAULT NULL,
        business_website VARCHAR(500) DEFAULT NULL,
        business_category VARCHAR(200) DEFAULT NULL,
        business_type VARCHAR(50) DEFAULT NULL,
        signature_data LONGTEXT DEFAULT NULL,
        niu_number VARCHAR(100) DEFAULT NULL,
        rccm_number VARCHAR(100) DEFAULT NULL,
        kyb_status VARCHAR(20) NOT NULL DEFAULT 'NOT_STARTED',
        admin_notes TEXT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY kyc_profiles_user_id_unique (user_id),
        CONSTRAINT kyc_profiles_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.execute(`ALTER TABLE kyc_profiles ADD COLUMN IF NOT EXISTS niu_number VARCHAR(100) DEFAULT NULL`);
    await conn.execute(`ALTER TABLE kyc_profiles ADD COLUMN IF NOT EXISTS rccm_number VARCHAR(100) DEFAULT NULL`);

    // 7. platform_config
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS platform_config (
        \`key\` VARCHAR(100) NOT NULL,
        value TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 8a. locked_balance on wallets
    await conn.execute(`
      ALTER TABLE wallets ADD COLUMN IF NOT EXISTS locked_balance DECIMAL(18,2) NOT NULL DEFAULT 0
    `);

    // 8b. Create USDT wallets for all existing users that don't have one
    await conn.execute(`
      INSERT INTO wallets (user_id, currency, balance, locked_balance, country)
      SELECT u.id, 'USDT', 0, 0, 'ZZ'
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM wallets w WHERE w.user_id = u.id AND w.currency = 'USDT'
      )
    `);

    // 8c. crypto_exchanges
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS crypto_exchanges (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        from_currency VARCHAR(10) NOT NULL,
        to_currency VARCHAR(10) NOT NULL,
        from_amount DECIMAL(18,2) NOT NULL,
        usdt_amount DECIMAL(18,8) NOT NULL,
        to_amount DECIMAL(18,2) DEFAULT NULL,
        exchange_rate DECIMAL(18,8) NOT NULL,
        fee_amount DECIMAL(18,2) NOT NULL DEFAULT '0.00',
        status VARCHAR(30) NOT NULL DEFAULT 'STEP1_DONE',
        tx_step1_id INT DEFAULT NULL,
        tx_step2_id INT DEFAULT NULL,
        admin_notes TEXT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT crypto_exchanges_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT crypto_exchanges_tx_step1_id_fk FOREIGN KEY (tx_step1_id) REFERENCES transactions(id),
        CONSTRAINT crypto_exchanges_tx_step2_id_fk FOREIGN KEY (tx_step2_id) REFERENCES transactions(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 9. usdt_rates
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS usdt_rates (
        pair VARCHAR(20) NOT NULL,
        rate DECIMAL(20,8) NOT NULL DEFAULT '0.00000000',
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (pair)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    const usdtPairs = ["USDT_XAF","XAF_USDT","USDT_XOF","XOF_USDT","USDT_CDF","CDF_USDT","EXCHANGE_FEE"];
    for (const pair of usdtPairs) {
      await conn.execute(`INSERT IGNORE INTO usdt_rates (pair, rate) VALUES (?, 0)`, [pair]);
    }

    // 8. Admin roles
    for (const email of ADMIN_EMAILS) {
      const [result]: any = await conn.execute(
        "UPDATE users SET role = 'ADMIN' WHERE LOWER(email) = LOWER(?) AND role != 'ADMIN'",
        [email]
      );
      if (result.affectedRows && result.affectedRows > 0) {
        logger.info({ email }, "Admin role assigned via startup migration");
      }
    }

    // 11. yookpay_margin on transactions
    await conn.execute(`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS yookpay_margin DECIMAL(18,4) DEFAULT '0.0000'
    `);

    await conn.execute(`
      UPDATE transactions SET yookpay_margin = GREATEST(
        CASE
          WHEN type IN ('DEPOSIT','WITHDRAWAL') AND country IN ('CM','CG','GA')
            THEN CAST(fee AS DECIMAL(18,4)) - CAST(amount AS DECIMAL(18,4)) * 0.015
          WHEN type IN ('DEPOSIT','WITHDRAWAL') AND country IN ('CI','SN','BF','BJ','GM','GN','ML','TG')
            THEN CAST(fee AS DECIMAL(18,4)) - CAST(amount AS DECIMAL(18,4)) * 0.019
          WHEN type = 'DEPOSIT'    AND country = 'CD'
            THEN CAST(fee AS DECIMAL(18,4)) - CAST(amount AS DECIMAL(18,4)) * 0.030
          WHEN type = 'WITHDRAWAL' AND country = 'CD'
            THEN CAST(fee AS DECIMAL(18,4)) - CAST(amount AS DECIMAL(18,4)) * 0.035
          ELSE 0
        END, 0
      )
      WHERE (yookpay_margin IS NULL OR yookpay_margin = 0)
        AND status = 'SUCCESS'
        AND type IN ('DEPOSIT','WITHDRAWAL')
    `);

    // 10. user_operator_fees
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS user_operator_fees (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        country VARCHAR(2) NOT NULL,
        operator VARCHAR(20) NOT NULL,
        pixpay_deposit DECIMAL(6,4) NOT NULL,
        pixpay_withdrawal DECIMAL(6,4) NOT NULL,
        margin_deposit DECIMAL(6,4) NOT NULL DEFAULT '0.0150',
        margin_withdrawal DECIMAL(6,4) NOT NULL DEFAULT '0.0150',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY user_operator_fees_uq (user_id, country, operator),
        CONSTRAINT user_operator_fees_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 11. payment_links
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS payment_links (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        token VARCHAR(32) NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT DEFAULT NULL,
        photo_data LONGTEXT DEFAULT NULL,
        price_type VARCHAR(10) NOT NULL DEFAULT 'FREE',
        price_amount DECIMAL(12,2) DEFAULT NULL,
        currency VARCHAR(10) DEFAULT NULL,
        countries TEXT NOT NULL DEFAULT '',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        click_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY payment_links_token_unique (token),
        CONSTRAINT payment_links_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await conn.execute(`ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS click_count INT NOT NULL DEFAULT 0`);
    await conn.execute(`ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);

    // 12. notifications
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        type VARCHAR(30) NOT NULL DEFAULT 'SYSTEM',
        title VARCHAR(200) NOT NULL,
        body TEXT NOT NULL,
        transaction_id INT DEFAULT NULL,
        read_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY notifications_user_id_idx (user_id),
        CONSTRAINT notifications_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT notifications_transaction_id_fk FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 13. support_links
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS support_links (
        id INT NOT NULL DEFAULT 1,
        whatsapp_url TEXT NOT NULL DEFAULT '',
        facebook_url TEXT NOT NULL DEFAULT '',
        telegram_url TEXT NOT NULL DEFAULT '',
        phone_url TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await conn.execute(`INSERT IGNORE INTO support_links (id) VALUES (1)`);

    // ── Maviance SmobilPay ────────────────────────────────────────────────────

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS maviance_services (
        id INT NOT NULL AUTO_INCREMENT,
        operator VARCHAR(30) NOT NULL,
        country VARCHAR(5) DEFAULT NULL,
        currency VARCHAR(10) NOT NULL,
        type VARCHAR(20) NOT NULL,
        service_id INT NOT NULL DEFAULT 0,
        active TINYINT(1) NOT NULL DEFAULT 1,
        notes TEXT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY maviance_services_uq (operator, country, currency, type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Use ON DUPLICATE KEY UPDATE (not INSERT IGNORE) so service IDs are
    // always corrected to the canonical staging values even if rows already
    // exist from a previous (broken) sync.
    await conn.execute(`
      INSERT INTO maviance_services (operator, country, currency, type, service_id, active, notes) VALUES
        ('MTN',    'CM', 'XAF', 'DEPOSIT',    20053, 1, 'MTN MoMo CM Cash-Out/Depot (CASHOUT) → collectstd'),
        ('MTN',    'CM', 'XAF', 'WITHDRAWAL', 20052, 1, 'MTN MoMo CM Cash-In/Retrait (CASHIN) → collectstd'),
        ('ORANGE', 'CM', 'XAF', 'DEPOSIT',    30053, 1, 'Orange Money CM Cash-Out (CASHOUT) → collectstd'),
        ('ORANGE', 'CM', 'XAF', 'WITHDRAWAL', 30052, 1, 'Orange Money CM Cash-In (CASHIN) → collectstd')
      ON DUPLICATE KEY UPDATE
        service_id = VALUES(service_id),
        active     = VALUES(active),
        notes      = VALUES(notes)
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS payment_provider_config (
        id INT NOT NULL AUTO_INCREMENT,
        country VARCHAR(5) NOT NULL,
        operator VARCHAR(30) NOT NULL,
        type VARCHAR(20) NOT NULL,
        provider VARCHAR(20) NOT NULL DEFAULT 'PIXPAY',
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY provider_config_uq (country, operator, type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    logger.info("Startup migrations completed successfully");
  } catch (err) {
    logger.error({ err }, "Startup migration error");
    // Don't crash the server — migrations are best-effort
  } finally {
    conn.release();
  }
}
