import { mysqlTable, int, varchar, boolean, text, timestamp, uniqueIndex } from "drizzle-orm/mysql-core";

/** Locally approved pawaPay provider-code mapping, synced from active-conf. */
export const pawapayServicesTable = mysqlTable("pawapay_services", {
  id: int("id").autoincrement().primaryKey(),
  operator: varchar("operator", { length: 30 }).notNull(),
  country: varchar("country", { length: 5 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  providerCode: varchar("provider_code", { length: 80 }).notNull(),
  active: boolean("active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("pawapay_services_uq").on(table.operator, table.country, table.currency, table.type)]);