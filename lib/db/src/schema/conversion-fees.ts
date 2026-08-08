import { pgTable, serial, numeric, varchar, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const conversionFeesTable = pgTable("conversion_fees", {
  id: serial("id").primaryKey(),
  // pair uniqueness enforced by DB constraint conversion_fees_pair_key (from raw-SQL migration)
  pair: varchar("pair", { length: 10 }).notNull(),
  rate: numeric("rate", { precision: 6, scale: 4 }).notNull().default("0.0190"),
  minAmount: numeric("min_amount", { precision: 12, scale: 0 }).notNull().default("1000"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertConversionFeeSchema = createInsertSchema(conversionFeesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertConversionFee = z.infer<typeof insertConversionFeeSchema>;
export type ConversionFee = typeof conversionFeesTable.$inferSelect;
