import { mysqlTable, int, decimal, varchar, timestamp } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const conversionFeesTable = mysqlTable("conversion_fees", {
  id: int("id").autoincrement().primaryKey(),
  pair: varchar("pair", { length: 10 }).notNull().unique(),
  rate: decimal("rate", { precision: 6, scale: 4 }).notNull().default("0.0190"),
  minAmount: decimal("min_amount", { precision: 12, scale: 0 }).notNull().default("1000"),
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
