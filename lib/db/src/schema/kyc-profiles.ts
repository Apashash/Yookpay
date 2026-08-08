import { pgTable, serial, integer, varchar, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const kycProfilesTable = pgTable("kyc_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  fullName: varchar("full_name", { length: 255 }),
  dateOfBirth: date("date_of_birth"),
  docType: varchar("doc_type", { length: 30 }),
  docNumber: varchar("doc_number", { length: 100 }),
  kycStatus: varchar("kyc_status", { length: 20 }).notNull().default("NOT_STARTED"),
  businessDescription: text("business_description"),
  businessWebsite: varchar("business_website", { length: 500 }),
  businessCategory: varchar("business_category", { length: 200 }),
  businessType: varchar("business_type", { length: 50 }),
  signatureData: text("signature_data"),
  niuNumber: varchar("niu_number", { length: 100 }),
  rccmNumber: varchar("rccm_number", { length: 100 }),
  kybStatus: varchar("kyb_status", { length: 20 }).notNull().default("NOT_STARTED"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertKycProfileSchema = createInsertSchema(kycProfilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertKycProfile = z.infer<typeof insertKycProfileSchema>;
export type KycProfile = typeof kycProfilesTable.$inferSelect;
