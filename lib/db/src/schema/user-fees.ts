import { mysqlTable, int, varchar, decimal, timestamp } from "drizzle-orm/mysql-core";
import { usersTable } from "./users";

export const userFeesTable = mysqlTable("user_fees", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  country: varchar("country", { length: 10 }).notNull(),
  operator: varchar("operator", { length: 20 }).notNull(),
  transactionType: varchar("transaction_type", { length: 20 }).notNull(),
  rate: decimal("rate", { precision: 6, scale: 4 }).notNull(),
  minFee: int("min_fee").notNull(),
  maxFee: int("max_fee"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserFee = typeof userFeesTable.$inferSelect;
