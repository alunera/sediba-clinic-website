import { pgTable, serial, integer, text, date, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const bookExpensesTable = pgTable("book_expenses", {
  id: serial("id").primaryKey(),
  requestId: text("request_id").notNull().unique(),
  date: date("date").notNull(),
  category: text("category").notNull(),
  payee: text("payee").notNull(),
  reference: text("reference").notNull(),
  amountCents: integer("amount_cents").notNull(),
  method: text("method").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  voidReason: text("void_reason").notNull().default(""),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
});
export const bookDepositsTable = pgTable("book_deposits", {
  id: serial("id").primaryKey(),
  requestId: text("request_id").notNull().unique(),
  date: date("date").notNull(),
  reference: text("reference").notNull(),
  bankCents: integer("bank_cents").notNull(),
  feeCents: integer("fee_cents").notNull(),
  grossCents: integer("gross_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  voidReason: text("void_reason").notNull().default(""),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
});
export const bookDepositItemsTable = pgTable("book_deposit_items", {
  depositId: integer("deposit_id").notNull().references(() => bookDepositsTable.id),
  receiptKey: text("receipt_key").notNull(),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
}, t => [primaryKey({ columns: [t.depositId, t.receiptKey] })]);
