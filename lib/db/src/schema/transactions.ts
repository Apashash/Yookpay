import { pgTable, serial, integer, decimal, varchar, timestamp, text, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull(), // DEPOSIT | WITHDRAWAL | TRANSFER
  status: varchar("status", { length: 20 }).notNull().default("PENDING"), // PENDING | SUCCESS | FAILED
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  fee: decimal("fee", { precision: 18, scale: 2 }).notNull().default("0"),
  netAmount: decimal("net_amount", { precision: 18, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull(),
  country: varchar("country", { length: 10 }),
  operator: varchar("operator", { length: 50 }),
  phone: varchar("phone", { length: 50 }),
  reference: varchar("reference", { length: 100 }).notNull().unique(),
  feeRate: decimal("fee_rate", { precision: 6, scale: 4 }),
  metadata: jsonb("metadata"),
  providerReference: text("provider_reference"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
