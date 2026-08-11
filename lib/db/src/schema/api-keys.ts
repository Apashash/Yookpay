import { mysqlTable, int, text, varchar, boolean, timestamp } from "drizzle-orm/mysql-core";
import { usersTable } from "./users";

export const apiKeysTable = mysqlTable("api_keys", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  keyHash: text("key_hash").notNull(),
  keyPrefix: varchar("key_prefix", { length: 20 }).notNull(),
  name: varchar("name", { length: 100 }).notNull().default("Clé principale"),
  keyType: varchar("key_type", { length: 10 }).notNull().default("payin"),
  active: boolean("active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ApiKey = typeof apiKeysTable.$inferSelect;
