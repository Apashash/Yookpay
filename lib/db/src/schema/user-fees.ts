import { pgTable, serial, integer, varchar, numeric, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userFeesTable = pgTable("user_fees", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  country: varchar("country", { length: 2 }).notNull(),
  operator: varchar("operator", { length: 20 }).notNull(),
  transactionType: varchar("transaction_type", { length: 20 }).notNull(),
  rate: numeric("rate", { precision: 6, scale: 4 }).notNull(),
  minFee: integer("min_fee").notNull(),
  maxFee: integer("max_fee"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserFee = typeof userFeesTable.$inferSelect;
