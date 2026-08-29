import app from "./app";
import { logger } from "./lib/logger";
import { runStartupMigrations } from "./lib/migrations";
import { startExpiryWorker } from "./lib/expiryWorker";
import { pool } from "@workspace/db";
import fs from "node:fs";
import path from "node:path";

const rawPort = process.env["PORT"] ?? process.env["port"] ?? "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

function loadDotEnv(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  try {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator <= 0) continue;

      const key = trimmed.slice(0, separator).trim();
      const value = trimmed
        .slice(separator + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");

      if (key && !(key in process.env)) {
        process.env[key] = value;
      }
    }
    logger.info({ envPath }, "Loaded environment variables from .env");
  } catch (err) {
    logger.warn({ err, envPath }, "Could not load .env file");
  }
}

async function startServer(): Promise<void> {
  // Diagnostic — log which provider keys are detected at startup
  const pixpayEnv = process.env["PIXPAY_ENV"] ?? "NON DÉFINI → sandbox utilisé par défaut ⚠️";
  logger.info(`[ENV CHECK] PIXPAY_ENV = ${pixpayEnv}`);
  const pixpayKeys = ["PIXPAY_API_KEY_XAF", "PIXPAY_API_KEY_XOF", "PIXPAY_API_KEY_CDF", "PIXPAY_API_KEY"];
  for (const k of pixpayKeys) {
    logger.info(`[ENV CHECK] ${k} = ${process.env[k] ? "SET ✓" : "NOT SET ✗"}`);
  }
  const mavianceEnv = process.env["MAVIANCE_ENV"] ?? "staging (défaut)";
  logger.info(`[ENV CHECK] MAVIANCE_ENV = ${mavianceEnv}`);
  logger.info(`[ENV CHECK] MAVIANCE_PUBLIC_KEY = ${process.env["MAVIANCE_PUBLIC_KEY"] ? "SET ✓" : "NOT SET ✗"}`);
  logger.info(`[ENV CHECK] MAVIANCE_SECRET     = ${process.env["MAVIANCE_SECRET"]     ? "SET ✓" : "NOT SET ✗"}`);
  logger.info(`[ENV CHECK] PAWAPAY_ENV = ${process.env["PAWAPAY_ENV"] ?? "sandbox (default)"}`);
  logger.info(`[ENV CHECK] PAWAPAY_API_TOKEN = ${process.env["PAWAPAY_API_TOKEN"] ? "SET ✓" : "NOT SET ✗"}`);

  const dbUrl = process.env.MYSQL_DATABASE_URL || process.env.DATABASE_URL;

  if (!dbUrl) {
    logger.warn(
      "MYSQL_DATABASE_URL is not set — using fallback localhost. " +
      "Set MYSQL_DATABASE_URL=mysql://USER:PASS@localhost:3306/DB_NAME in your environment variables."
    );
  } else {
    logger.info(`[ENV CHECK] MYSQL_DATABASE_URL host = ${(() => { try { return new URL(dbUrl).hostname; } catch { return "(parse error)"; } })()}`);
  }

  try {
    await pool.query("select 1");
    logger.info("Database connection check passed ✓");
  } catch (err) {
    logger.error({ err }, "Database connection check FAILED — check MYSQL_DATABASE_URL");
  }

  try {
    await runStartupMigrations();
  } catch (err) {
    logger.error({ err }, "Startup migrations failed");
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

loadDotEnv();
void startServer();
