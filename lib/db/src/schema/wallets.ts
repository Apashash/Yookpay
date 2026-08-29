import { mysqlTable, int, decimal, varchar, timestamp, uniqueIndex } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const walletsTable = mysqlTable("wallets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  currency: varchar("currency", { length: 10 }).notNull(),
  balance: decimal("balance", { precision: 18, scale: 2 }).notNull().default("0"),
  lockedBalance: decimal("locked_balance", { precision: 18, scale: 2 }).notNull().default("0"),
  country: varchar("country", { length: 10 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("wallets_user_currency_country_uq").on(table.userId, table.currency, table.country),
]);

export const insertWalletSchema = createInsertSchema(walletsTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof walletsTable.$inferSelect;
