import { date, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientRecordsTable = pgTable("client_records", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  dateOfBirth: date("date_of_birth", { mode: "string" }),
  internalNotes: text("internal_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertClientRecordSchema = createInsertSchema(clientRecordsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type ClientRecord = typeof clientRecordsTable.$inferSelect;
export type InsertClientRecord = z.infer<typeof insertClientRecordSchema>;