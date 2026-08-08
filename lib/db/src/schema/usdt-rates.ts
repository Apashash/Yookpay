import { pgTable, varchar, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usdtRatesTable = pgTable("usdt_rates", {
  pair: varchar("pair", { length: 20 }).primaryKey(),
  rate: decimal("rate", { precision: 20, scale: 8 }).notNull().default("0"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUsdtRateSchema = createInsertSchema(usdtRatesTable);
export type InsertUsdtRate = z.infer<typeof insertUsdtRateSchema>;
export type UsdtRate = typeof usdtRatesTable.$inferSelect;
