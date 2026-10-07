import { Router, type ErrorRequestHandler } from "express";
import { pool } from "@workspace/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { createProductInput, updateProductInput, movementInput, StockError, stockTransaction,
  productForUpdate, applyMovement, presentProduct, type ProductRow } from "../lib/stock";

const router = Router();
router.use("/admin/stock", requireAdmin);
function idOf(raw: unknown) {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) throw new StockError(400,"Invalid product ID");
  return id;
}
router.get("/admin/stock", async (_req,res) => {
  const { rows } = await pool.query<ProductRow>("SELECT * FROM stock_products ORDER BY active DESC,name,id");
  res.json(rows.map(presentProduct));
});
router.post("/admin/stock", async (req,res) => {
  const parsed = createProductInput.safeParse(req.body);
  if (!parsed.success) throw new StockError(400,"Enter a name, SKU, unit, whole quantities and a valid price.");
  const d = { ...parsed.data, name: parsed.data.name.trim(), sku: parsed.data.sku.trim().toUpperCase(), unit: parsed.data.unit.trim() };
  const result = await stockTransaction(async tx => {
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`stock-product:${d.requestId}`]);
    const { rows: [prior] } = await tx.query<ProductRow>("SELECT * FROM stock_products WHERE request_id=$1", [d.requestId]);
    if (prior) {
      const { rows: [same] } = await tx.query("SELECT creation_input=$2::jsonb AS same FROM stock_products WHERE id=$1", [prior.id,JSON.stringify(d)]);
      if (!same.same) throw new StockError(409,"This request ID was already used for another product.");
      return presentProduct(prior);
    }
    const { rows: [p] } = await tx.query<ProductRow>(`INSERT INTO stock_products
      (request_id,creation_input,name,sku,unit,reorder_level,unit_price_cents,active,unit_cost_cents)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [d.requestId,JSON.stringify(d),d.name,d.sku,d.unit,d.reorderLevel,d.unitPriceCents,d.active,d.unitCostCents ?? null]);
    if (!d.openingQuantity) return presentProduct(p!);
    return applyMovement(tx,p!,{ requestId: `opening:${p!.id}`, kind: "opening", quantity: d.openingQuantity,reason:"Opening stock" });
  });
  res.json(result);
});
router.patch("/admin/stock/:id", async (req,res) => {
  const id = idOf(req.params.id), parsed = updateProductInput.safeParse(req.body);
  if (!parsed.success) throw new StockError(400,"Enter valid product details and the current version.");
  const d = parsed.data;
  const { rows: [p] } = await pool.query<ProductRow>(`UPDATE stock_products SET name=$2,sku=$3,unit=$4,
    reorder_level=$5,unit_price_cents=$6,active=$7,version=version+1,
    unit_cost_cents=CASE WHEN $10 THEN $9 ELSE unit_cost_cents END WHERE id=$1 AND version=$8
    AND (unit=$4 OR NOT EXISTS(SELECT 1 FROM stock_movements WHERE product_id=$1)) RETURNING *`,
    [id,d.name.trim(),d.sku.trim().toUpperCase(),d.unit.trim(),d.reorderLevel,d.unitPriceCents,d.active,d.version,d.unitCostCents ?? null,d.unitCostCents !== undefined]);
  if (!p) throw new StockError(409,"Product changed, no longer exists, or its unit was changed after stock movements. Refresh before editing; keep the original unit when history exists.");
  res.json(presentProduct(p));
});
router.get("/admin/stock/:id/movements", async (req,res) => {
  const id = idOf(req.params.id);
  const { rows: exists } = await pool.query("SELECT id FROM stock_products WHERE id=$1",[id]);
  if (!exists.length) throw new StockError(404,"Stock product not found");
  const { rows } = await pool.query(`SELECT id,product_id AS "productId",kind,quantity,reason,sale_id AS "saleId",created_at AS "createdAt"
    FROM stock_movements WHERE product_id=$1 ORDER BY id DESC`,[id]);
  res.json(rows);
});
router.post("/admin/stock/:id/movements", async (req,res) => {
  const id = idOf(req.params.id), parsed = movementInput.safeParse(req.body);
  if (!parsed.success) throw new StockError(400,"Enter a nonzero whole quantity and reason. Receipts and returns must be positive.");
  const d = { ...parsed.data,reason: parsed.data.reason.trim() };
  const result = await stockTransaction(async tx => {
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`stock-movement:${d.requestId}`]);
    const p = await productForUpdate(tx,id);
    const { rows: [prior] } = await tx.query("SELECT * FROM stock_movements WHERE request_id=$1", [d.requestId]);
    if (prior) {
      if (prior.product_id!==id || prior.kind!==d.kind || prior.quantity!==d.quantity || prior.reason!==d.reason)
        throw new StockError(409,"Request ID was already used for a different stock movement.");
      return presentProduct(p);
    }
    if (!p.active && d.kind==="received") throw new StockError(409,"Reactivate this product before receiving new deliveries.");
    return applyMovement(tx,p,d);
  });
  res.json(result);
});
const errors: ErrorRequestHandler = (err,_req,res,next) => {
  if (err instanceof StockError) { res.status(err.status).json({ error: err.message }); return; }
  if (err.code==="23505") { res.status(409).json({ error:"SKU or stock request already exists. Refresh before retrying." }); return; }
  next(err);
};
router.use(errors);
export default router;
