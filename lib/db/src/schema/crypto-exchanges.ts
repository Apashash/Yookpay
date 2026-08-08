import { pgTable, serial, integer, varchar, decimal, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { transactionsTable } from "./transactions";

export const cryptoExchangesTable = pgTable("crypto_exchanges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  fromCurrency: varchar("from_currency", { length: 10 }).notNull(),
  toCurrency: varchar("to_currency", { length: 10 }).notNull(),
  fromAmount: decimal("from_amount", { precision: 18, scale: 2 }).notNull(),
  usdtAmount: decimal("usdt_amount", { precision: 18, scale: 8 }).notNull(),
  toAmount: decimal("to_amount", { precision: 18, scale: 2 }),
  exchangeRate: decimal("exchange_rate", { precision: 18, scale: 8 }).notNull(),
  feeAmount: decimal("fee_amount", { precision: 18, scale: 2 }).notNull().default("0"),
  status: varchar("status", { length: 30 }).notNull().default("STEP1_DONE"),
  txStep1Id: integer("tx_step1_id").references(() => transactionsTable.id),
  txStep2Id: integer("tx_step2_id").references(() => transactionsTable.id),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCryptoExchangeSchema = createInsertSchema(cryptoExchangesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCryptoExchange = z.infer<typeof insertCryptoExchangeSchema>;
export type CryptoExchange = typeof cryptoExchangesTable.$inferSelect;
