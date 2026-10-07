import { pool } from "@workspace/db";
import { CreateStockProductBody, UpdateStockProductBody, RecordStockMovementBody } from "@workspace/api-zod";

const connect = () => pool.connect();
type Connection = Awaited<ReturnType<typeof connect>>;
export class StockError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const validProduct = (d: { name: string; sku: string; unit: string; reorderLevel: number; unitPriceCents: number; unitCostCents?: number | null }) =>
  !!d.name.trim() && !!d.sku.trim() && !!d.unit.trim() && Number.isSafeInteger(d.reorderLevel) && Number.isSafeInteger(d.unitPriceCents) &&
  (d.unitCostCents == null || Number.isSafeInteger(d.unitCostCents));
export const createProductInput = CreateStockProductBody.refine(d => validProduct(d) && Number.isSafeInteger(d.openingQuantity));
export const updateProductInput = UpdateStockProductBody.refine(d => validProduct(d) && Number.isSafeInteger(d.version));
export const movementInput = RecordStockMovementBody.refine(d => Number.isSafeInteger(d.quantity) && d.quantity !== 0 &&
  (d.kind === "adjustment" || d.quantity > 0) && !!d.reason.trim());

export async function stockTransaction<T>(fn: (tx: Connection) => Promise<T>) {
  const tx = await pool.connect();
  try { await tx.query("BEGIN"); const result = await fn(tx); await tx.query("COMMIT"); return result; }
  catch(e) { await tx.query("ROLLBACK"); throw e; }
  finally { tx.release(); }
}
export type ProductRow = {
  id: number; request_id: string; creation_input: unknown; name: string; sku: string; unit: string;
  reorder_level: number; unit_price_cents: number; unit_cost_cents: number | null; active: boolean; on_hand: number; version: number;
};
export function presentProduct(p: ProductRow) {
  return { id: p.id, name: p.name, sku: p.sku, unit: p.unit, reorderLevel: p.reorder_level,
    unitPriceCents: p.unit_price_cents, unitCostCents: p.unit_cost_cents, active: p.active, onHand: p.on_hand, version: p.version };
}
export async function productForUpdate(tx: Connection, id: number) {
  const { rows: [p] } = await tx.query<ProductRow>("SELECT * FROM stock_products WHERE id=$1 FOR UPDATE", [id]);
  if (!p) throw new StockError(404, "Stock product not found");
  return p;
}
export async function applyMovement(tx: Connection, p: ProductRow, input: {
  requestId: string; kind: string; quantity: number; reason: string; saleId?: number;
}) {
  const next = p.on_hand + input.quantity;
  if (!Number.isSafeInteger(next) || next < 0 || next > 1000000) throw new StockError(409, `${p.name}: insufficient stock or quantity exceeds the stock limit. Refresh the stock list.`);
  await tx.query(`INSERT INTO stock_movements(product_id,request_id,kind,quantity,reason,sale_id) VALUES($1,$2,$3,$4,$5,$6)`,
    [p.id,input.requestId,input.kind,input.quantity,input.reason,input.saleId ?? null]);
  const { rows: [updated] } = await tx.query<ProductRow>("UPDATE stock_products SET on_hand=$2 WHERE id=$1 RETURNING *", [p.id,next]);
  return presentProduct(updated!);
}
export async function deductSaleStock(tx: Connection, saleId: number, items: { productId?: number; quantity: number; kind: string; unitCostCents?: number | null }[]) {
  const quantities = new Map<number, number>();
  for (const item of items) {
    if (item.productId === undefined) continue; // Historical/untracked manual product sales stay distinct.
    if (item.kind !== "product") throw new StockError(400, "Only product sale lines can reference stock.");
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }
  // Stable locking order prevents two multi-product sales from deadlocking.
  for (const [id, quantity] of [...quantities].sort(([a],[b]) => a-b)) {
    const p = await productForUpdate(tx,id);
    if (!p.active) throw new StockError(409, `${p.name} is archived. Choose an active product.`);
    // Snapshot the staff-recorded cost under the same lock as stock deduction.
    for (const item of items) if (item.productId === id) item.unitCostCents = p.unit_cost_cents;
    await applyMovement(tx,p,{ requestId: `sale:${saleId}:product:${id}`, kind: "sale", quantity: -quantity,
      reason: `Sold on SED-${String(saleId).padStart(6,"0")}`,saleId });
  }
}
