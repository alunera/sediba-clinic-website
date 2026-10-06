import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { clientRecordsTable } from "./client-records";

export const salesTable = pgTable("clinic_sales", {
  id: serial("id").primaryKey(),
  requestId: text("request_id").notNull().unique(),
  clientId: integer("client_id").notNull().references(() => clientRecordsTable.id),
  clientName: text("client_name").notNull(),
  items: jsonb("items").notNull(),
  totalCents: integer("total_cents").notNull(),
  notes: text("notes").notNull().default(""),
  voidReason: text("void_reason").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
});

export const saleEntriesTable = pgTable("clinic_sale_entries", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull().references(() => salesTable.id),
  requestId: text("request_id").notNull().unique(),
  kind: text("kind").notNull(),
  amountCents: integer("amount_cents").notNull(),
  method: text("method").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
