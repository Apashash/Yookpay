import { pgTable, serial, integer, varchar, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const paymentLinksTable = pgTable("payment_links", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 32 }).notNull().unique(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  photoData: text("photo_data"),
  priceType: varchar("price_type", { length: 10 }).notNull().default("FREE"),
  priceAmount: numeric("price_amount", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 10 }),
  isActive: boolean("is_active").notNull().default(true),
  clickCount: integer("click_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPaymentLinkSchema = createInsertSchema(paymentLinksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPaymentLink = z.infer<typeof insertPaymentLinkSchema>;
export type PaymentLink = typeof paymentLinksTable.$inferSelect;
