import app from "./app";
import { logger } from "./lib/logger";
import { runStartupMigrations } from "./lib/migrations";
import { startExpiryWorker } from "./lib/expiryWorker";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function startServer(): Promise<void> {
  try {
    await pool.query("select 1");
    logger.info(
      {
        dbHost: new URL(process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || "").hostname,
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
