import { Router } from "express";
import { pool } from "@workspace/db";
import {
  VoidAdminSaleBody,
  ListAdminSalesResponse, AddAdminSaleEntryResponse as CreateAdminSaleResponse, GetAdminFinancialReportResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/admin-auth";
import { entryError, saleBalance, saleTotal, validReportDates, saleInput, saleEntryInput } from "../lib/sales";

const router = Router();
router.use("/admin/sales", requireAdmin);
router.use("/admin/financial-report", requireAdmin);
const connect = () => pool.connect();
type Connection = Awaited<ReturnType<typeof connect>>;
type SaleRow = {
  id: number; request_id: string; client_id: number; client_name: string;
  items: Array<{ description: string; kind: string; quantity: number; unitPriceCents: number }>;
  total_cents: number; notes: string; void_reason: string; created_at: Date; voided_at: Date | null;
};
type EntryRow = {
  id: number; sale_id: number; request_id: string; kind: "payment" | "refund";
  amount_cents: number; method: string; reason: string; created_at: Date;
};
class RequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function present(sale: SaleRow, rows: EntryRow[]) {
  const entries = rows.map(e => ({
    id: e.id, kind: e.kind, amountCents: e.amount_cents, method: e.method,
    reason: e.reason, createdAt: e.created_at.toISOString(),
  }));
  return {
    id: sale.id, reference: `SED-${String(sale.id).padStart(6, "0")}`,
    clientId: sale.client_id, clientName: sale.client_name, items: sale.items,
    totalCents: sale.total_cents, notes: sale.notes, voidReason: sale.void_reason,
    createdAt: sale.created_at.toISOString(), entries,
    ...saleBalance(sale.total_cents, entries, !!sale.voided_at),
  };
}
async function getSale(tx: Connection, id: number) {
  const { rows: [sale] } = await tx.query<SaleRow>("SELECT * FROM clinic_sales WHERE id=$1 FOR UPDATE", [id]);
  if (!sale) throw new RequestError(404, "Sale not found");
  const { rows: entries } = await tx.query<EntryRow>("SELECT * FROM clinic_sale_entries WHERE sale_id=$1 ORDER BY id", [id]);
  return { sale, entries };
}
function saleId(raw: string | string[]) {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) throw new RequestError(400, "Invalid sale ID");
  return id;
}
async function transaction<T>(fn: (tx: Connection) => Promise<T>) {
  const tx = await pool.connect();
  try {
    await tx.query("BEGIN");
    const result = await fn(tx);
    await tx.query("COMMIT");
    return result;
  } catch (err) {
    await tx.query("ROLLBACK");
    throw err;
  } finally { tx.release(); }
}

router.get("/admin/sales", async (_req, res) => {
  // One snapshot avoids mixing concurrently inserted payments and sales.
  const result = await transaction(async tx => {
    await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    const { rows: sales } = await tx.query<SaleRow>("SELECT * FROM clinic_sales ORDER BY id DESC");
    const { rows: entries } = await tx.query<EntryRow>("SELECT * FROM clinic_sale_entries ORDER BY id");
    const bySale = new Map<number, EntryRow[]>();
    for (const entry of entries) bySale.set(entry.sale_id, [...(bySale.get(entry.sale_id) ?? []), entry]);
    return sales.map(s => present(s, bySale.get(s.id) ?? []));
  });
  res.json(ListAdminSalesResponse.parse(result));
});

router.post("/admin/sales", async (req, res) => {
  const parsed = saleInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Provide a client, valid line items and a request ID" }); return; }
  const { requestId, clientId } = parsed.data;
  const notes = parsed.data.notes?.trim() ?? "";
  const items = parsed.data.items.map(i => ({ description: i.description.trim(), kind: i.kind, quantity: i.quantity, unitPriceCents: i.unitPriceCents }));
  if (items.some(i => !i.description)) { res.status(400).json({ error: "Item descriptions cannot be blank" }); return; }
  let total: number;
  try { total = saleTotal(items); } catch (e) { res.status(400).json({ error: (e as Error).message }); return; }
  const result = await transaction(async tx => {
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`sale:${requestId}`]);
    const { rows: [existing] } = await tx.query<SaleRow>("SELECT * FROM clinic_sales WHERE request_id=$1", [requestId]);
    if (existing) {
      const canonical = (xs: SaleRow["items"]) => xs.map(i => [i.description, i.kind, i.quantity, i.unitPriceCents]);
      if (existing.client_id !== clientId || existing.notes !== notes || JSON.stringify(canonical(existing.items)) !== JSON.stringify(canonical(items))) {
        throw new RequestError(409, "Request ID already used for a different sale");
      }
      const { sale, entries } = await getSale(tx, existing.id);
      return present(sale, entries);
    }
    const { rows: [client] } = await tx.query<{ name: string }>("SELECT name FROM client_records WHERE id=$1", [clientId]);
    if (!client) throw new RequestError(400, "Choose an existing client");
    const { rows: [sale] } = await tx.query<SaleRow>(
      "INSERT INTO clinic_sales (request_id,client_id,client_name,items,total_cents,notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [requestId, clientId, client.name, JSON.stringify(items), total, notes],
    );
    return present(sale!, []);
  });
  res.status(201).json(CreateAdminSaleResponse.parse(result));
});

router.post("/admin/sales/:id/entries", async (req, res) => {
  const id = saleId(req.params.id);
  const parsed = saleEntryInput.safeParse(req.body);
  if (!parsed.success || !parsed.data.reason.trim()) { res.status(400).json({ error: "Provide a positive amount, payment method and reason/reference" }); return; }
  const data = { ...parsed.data, reason: parsed.data.reason.trim() };
  const result = await transaction(async tx => {
    // All financial mutations on a sale serialize on the same row.
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`entry:${data.requestId}`]);
    const { sale, entries } = await getSale(tx, id);
    const { rows: [previous] } = await tx.query<EntryRow>("SELECT * FROM clinic_sale_entries WHERE request_id=$1", [data.requestId]);
    if (previous) {
      if (previous.sale_id !== id || previous.kind !== data.kind || previous.amount_cents !== data.amountCents || previous.method !== data.method || previous.reason !== data.reason) {
        throw new RequestError(409, "Request ID already used for another transaction");
      }
      return present(sale, entries);
    }
    const error = entryError(sale.total_cents, entries.map(e => ({ kind: e.kind, amountCents: e.amount_cents })), !!sale.voided_at, data);
    if (error) throw new RequestError(409, error);
    const { rows: [entry] } = await tx.query<EntryRow>(
      "INSERT INTO clinic_sale_entries (sale_id,request_id,kind,amount_cents,method,reason) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [id, data.requestId, data.kind, data.amountCents, data.method, data.reason],
    );
    return present(sale, [...entries, entry!]);
  });
  res.json(CreateAdminSaleResponse.parse(result));
});

router.post("/admin/sales/:id/void", async (req, res) => {
  const id = saleId(req.params.id);
  const parsed = VoidAdminSaleBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.reason.trim()) { res.status(400).json({ error: "A reason for voiding is required" }); return; }
  const result = await transaction(async tx => {
    const { sale, entries } = await getSale(tx, id);
    if (sale.voided_at) return present(sale, entries);
    if (entries.length) throw new RequestError(409, "A sale with payment history cannot be voided; record an externally issued refund instead");
    const { rows: [updated] } = await tx.query<SaleRow>(
      "UPDATE clinic_sales SET void_reason=$2, voided_at=now() WHERE id=$1 RETURNING *", [id, parsed.data.reason.trim()],
    );
    return present(updated!, entries);
  });
  res.json(CreateAdminSaleResponse.parse(result));
});

router.get("/admin/financial-report", async (req, res) => {
  const { from, to } = req.query;
  if (typeof from !== "string" || typeof to !== "string" || !validReportDates(from, to)) {
    res.status(400).json({ error: "Choose valid from/to dates in order, covering no more than 367 days" }); return;
  }
  const report = await transaction(async tx => {
    await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    // Timestamp boundaries are clinic-local calendar dates, not browser timezone dates.
    const range = `>= ($1::date::timestamp AT TIME ZONE 'Africa/Johannesburg') AND %DATE% < (($2::date + 1)::timestamp AT TIME ZONE 'Africa/Johannesburg')`;
    const inRange = (column: string) => `${column} ${range.replace("%DATE%", column)}`;
    const { rows } = await tx.query<{
      reference: string; clientName: string; source: "manual_sale" | "booking_payment" | "booking_in_salon";
      kind: "payment" | "refund"; amountCents: number; method: string; createdAt: Date;
    }>(`
      SELECT 'SED-' || lpad(s.id::text,6,'0') AS reference, s.client_name AS "clientName",
        'manual_sale' AS source, e.kind, e.amount_cents AS "amountCents", e.method, e.created_at AS "createdAt"
      FROM clinic_sale_entries e JOIN clinic_sales s ON s.id=e.sale_id
      WHERE ${inRange("e.created_at")}
      UNION ALL
      SELECT p.booking_ref, a.client_name,
        CASE WHEN p.provider='in_salon' THEN 'booking_in_salon' ELSE 'booking_payment' END,
        'payment', p.amount_cents, CASE WHEN p.provider='in_salon' THEN p.method ELSE 'yoco' END, p.updated_at
      FROM payments p JOIN appointments a ON a.id=p.appointment_id
      WHERE p.status='complete' AND ${inRange("p.updated_at")}
      UNION ALL
      SELECT p.booking_ref, a.client_name,
        CASE WHEN p.provider='in_salon' THEN 'booking_in_salon' ELSE 'booking_payment' END,
        'refund', r.amount_cents, r.method, r.created_at
      FROM appointment_refunds r JOIN payments p ON p.id=r.payment_id
      JOIN appointments a ON a.id=p.appointment_id
      WHERE ${inRange("r.created_at")}
      ORDER BY "createdAt" DESC`, [from, to]);
    const { rows: [sales] } = await tx.query<{ total: string }>(
      `SELECT COALESCE(sum(total_cents),0) AS total FROM clinic_sales s WHERE voided_at IS NULL AND ${inRange("s.created_at")}`, [from, to],
    );
    const { rows: [outstanding] } = await tx.query<{ total: string }>(`
      SELECT COALESCE(sum(GREATEST(s.total_cents-COALESCE(p.paid,0),0)),0) AS total
      FROM clinic_sales s LEFT JOIN (
        SELECT sale_id, sum(amount_cents) AS paid FROM clinic_sale_entries WHERE kind='payment' GROUP BY sale_id
      ) p ON p.sale_id=s.id WHERE s.voided_at IS NULL`);
    const receivedCents = rows.filter(r => r.kind === "payment").reduce((s, r) => s + r.amountCents, 0);
    const refundedCents = rows.filter(r => r.kind === "refund").reduce((s, r) => s + r.amountCents, 0);
    return {
      from, to, receivedCents, refundedCents, netReceiptsCents: receivedCents - refundedCents,
      manualSalesCents: Number(sales!.total), outstandingCents: Number(outstanding!.total),
      rows: rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })),
    };
  });
  res.json(GetAdminFinancialReportResponse.parse(report));
});

router.use((err: Error, req: import("express").Request, res: import("express").Response, _next: import("express").NextFunction) => {
  if (err instanceof RequestError) { res.status(err.status).json({ error: err.message }); return; }
  req.log.error({ err }, "Sales request failed");
  res.status(500).json({ error: "Unable to complete this sales request. Please retry." });
});
export default router;
