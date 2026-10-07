import { pgTable, serial, integer, text, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { salesTable } from "./sales";

export const stockProductsTable = pgTable("stock_products", {
  id: serial("id").primaryKey(),
  requestId: text("request_id").notNull().unique(),
  creationInput: jsonb("creation_input").notNull(),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  unit: text("unit").notNull(),
  reorderLevel: integer("reorder_level").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  unitCostCents: integer("unit_cost_cents"),
  active: boolean("active").notNull().default(true),
  onHand: integer("on_hand").notNull().default(0),
  version: integer("version").notNull().default(1),
});
export const stockMovementsTable = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => stockProductsTable.id),
  requestId: text("request_id").notNull().unique(),
  kind: text("kind").notNull(),
  quantity: integer("quantity").notNull(),
  reason: text("reason").notNull(),
  saleId: integer("sale_id").references(() => salesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
