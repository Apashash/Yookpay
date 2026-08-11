import { mysqlTable, int, text, varchar, timestamp } from "drizzle-orm/mysql-core";
import { usersTable } from "./users";

export const kycDocumentsTable = mysqlTable("kyc_documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("PENDING"),
  fileName: varchar("file_name", { length: 255 }),
  fileData: text("file_data"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type KycDocument = typeof kycDocumentsTable.$inferSelect;
