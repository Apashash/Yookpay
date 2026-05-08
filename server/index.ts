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
  try {
    await pool.query("select 1");
    logger.info("Database connection OK");
  } catch (err) {
    logger.error({ err }, "Database connection failed");
  }

  try {
    await runStartupMigrations();
  } catch (err) {
    logger.error({ err }, "Startup migrations failed");
  }

  app.listen(port, () => {
    logger.info({ port }, "Server listening");
    startExpiryWorker();
  }).on("error", (err) => {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  });
}

void startServer();
