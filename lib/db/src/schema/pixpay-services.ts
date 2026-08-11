import { mysqlTable, int, varchar, boolean, text, timestamp, unique } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pixpayServicesTable = mysqlTable("pixpay_services", {
  id: int("id").autoincrement().primaryKey(),
  operator: varchar("operator", { length: 30 }).notNull(),
  country: varchar("country", { length: 5 }),
  currency: varchar("currency", { length: 10 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  serviceId: int("service_id").notNull().default(0),
  active: boolean("active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  unique("pixpay_services_uq").on(t.operator, t.country, t.currency, t.type),
]);

export const insertPixpayServiceSchema = createInsertSchema(pixpayServicesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPixpayService = z.infer<typeof insertPixpayServiceSchema>;
export type PixpayService = typeof pixpayServicesTable.$inferSelect;
