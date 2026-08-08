import { pgTable, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const supportLinksTable = pgTable("support_links", {
  id: integer("id").primaryKey().default(1),
  whatsappUrl: text("whatsapp_url").notNull().default(""),
  facebookUrl: text("facebook_url").notNull().default(""),
  telegramUrl: text("telegram_url").notNull().default(""),
  phoneUrl: text("phone_url").notNull().default(""),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSupportLinksSchema = createInsertSchema(supportLinksTable).omit({
  updatedAt: true,
});
export type InsertSupportLinks = z.infer<typeof insertSupportLinksSchema>;
export type SupportLinks = typeof supportLinksTable.$inferSelect;
