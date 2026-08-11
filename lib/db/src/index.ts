import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const connectionString =
  process.env.MYSQL_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "[db] WARNING: MYSQL_DATABASE_URL (or DATABASE_URL) is not set. " +
    "Database queries will fail until this environment variable is configured."
  );
}

export const pool = mysql.createPool({
  uri: connectionString || "mysql://root@localhost:3306/yookpay",
  waitForConnections: true,
  connectionLimit: 10,
});

export const db = drizzle(pool, { schema, mode: "default" });

export * from "./schema";
