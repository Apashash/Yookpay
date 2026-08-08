import { pgTable, serial, integer, varchar, numeric, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const userOperatorFeesTable = pgTable("user_operator_fees", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  country: varchar("country", { length: 2 }).notNull(),
  operator: varchar("operator", { length: 20 }).notNull(),
  pixpayDeposit: numeric("pixpay_deposit", { precision: 6, scale: 4 }).notNull(),
  pixpayWithdrawal: numeric("pixpay_withdrawal", { precision: 6, scale: 4 }).notNull(),
  marginDeposit: numeric("margin_deposit", { precision: 6, scale: 4 }).notNull().default("0.015"),
  marginWithdrawal: numeric("margin_withdrawal", { precision: 6, scale: 4 }).notNull().default("0.015"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  unique().on(t.userId, t.country, t.operator),
]);

export const insertUserOperatorFeeSchema = createInsertSchema(userOperatorFeesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserOperatorFee = z.infer<typeof insertUserOperatorFeeSchema>;
export type UserOperatorFee = typeof userOperatorFeesTable.$inferSelect;
