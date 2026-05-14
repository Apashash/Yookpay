import app from "./app";
import { logger } from "./lib/logger";
import { runStartupMigrations } from "./lib/migrations";
import { startExpiryWorker } from "./lib/expiryWorker";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"] ?? process.env["port"] ?? "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function startServer(): Promise<void> {
  // Diagnostic — log which PixPay keys are detected at startup
  const pixpayKeys = ["PIXPAY_API_KEY_XAF", "PIXPAY_API_KEY_XOF", "PIXPAY_API_KEY_CDF", "PIXPAY_API_KEY"];
  for (const k of pixpayKeys) {
    logger.info(`[ENV CHECK] ${k} = ${process.env[k] ? "SET ✓" : "NOT SET ✗"}`);
  }

  const dbUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

  if (!dbUrl) {
    logger.error(
      "SUPABASE_DATABASE_URL is not set — database queries will fail. " +
      "Add it to your environment variables (cPanel → Node.js → Environment Variables)."
    );
  } else {
    try {
      await pool.query("select 1");
      logger.info(
        {
          dbHost: new URL(dbUrl).hostname,
        },
        "Database connection check passed",
      );
    } catch (err) {
      logger.error({ err }, "Database connection check failed");
    }

    try {
      await runStartupMigrations();
    } catch (err) {
      logger.error({ err }, "Startup migrations failed");
    }
  }

  const server = app.listen(port, () => {
    logger.info({ port }, "Server listening");
    if (process.env.SKIP_EXPIRY_WORKER !== "true") {
      startExpiryWorker();
    }
  });

  server.on("error", (err) => {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  });
}

void startServer();
