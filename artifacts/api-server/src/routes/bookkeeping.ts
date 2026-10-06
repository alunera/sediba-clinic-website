import { Router } from "express";
import { pool } from "@workspace/db";
import { GetBookkeepingResponse } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/admin-auth";
import { validReportDates } from "../lib/sales";
import { expenseInput, depositInput, bookVoidInput, depositError, receiptSql } from "../lib/bookkeeping";

const router = Router();
router.use("/admin/bookkeeping", requireAdmin);
const connect = () => pool.connect();
type Connection = Awaited<ReturnType<typeof connect>>;
class BookError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
async function transaction<T>(fn: (tx: Connection) => Promise<T>) {
  const tx = await pool.connect();
  try { await tx.query("BEGIN"); const value = await fn(tx); await tx.query("COMMIT"); return value; }
  catch (err) { await tx.query("ROLLBACK"); throw err; }
  finally { tx.release(); }
}
function validId(raw: unknown) {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) throw new BookError(400, "Invalid record ID");
  return id;
}
// Financial mutations are infrequent; one shared lock makes matching, undo and retries atomic.
async function lock(tx: Connection) { await tx.query("SELECT pg_advisory_xact_lock(82493012)"); }

router.get("/admin/bookkeeping", async (req, res) => {
  const { from, to } = req.query;
  if (typeof from !== "string" || typeof to !== "string" || !validReportDates(from, to)) {
    throw new BookError(400, "Choose valid dates covering no more than 367 days.");
  }
  const result = await transaction(async tx => {
    await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    const { rows: receipts } = await tx.query(`
      SELECT r.*, i.deposit_id AS "depositId" FROM (${receiptSql}) r
      LEFT JOIN book_deposit_items i ON i.receipt_key=r.key AND i.voided_at IS NULL
      WHERE r.date BETWEEN $1 AND $2 ORDER BY r.date DESC,r.key`, [from, to]);
    const { rows: expenses } = await tx.query(`
      SELECT 'expense:' || id AS key,to_char(date,'YYYY-MM-DD') AS date,'expense' AS kind,
      payee AS description,reference,category,method,amount_cents AS "amountCents",
      void_reason AS "voidReason",NULL::int AS "depositId"
      FROM book_expenses WHERE date BETWEEN $1::date AND $2::date
      UNION ALL
      SELECT 'fee:' || id,to_char(date,'YYYY-MM-DD'),'fee','Deposit processing fee',reference,
      'bank_fees','withheld',fee_cents,void_reason,id
      FROM book_deposits WHERE fee_cents > 0 AND date BETWEEN $1::date AND $2::date`, [from, to]);
    const { rows: unmatchedReceipts } = await tx.query(`
      SELECT r.*,NULL::int AS "depositId" FROM (${receiptSql}) r
      WHERE r.kind='receipt' AND NOT EXISTS (
        SELECT 1 FROM book_deposit_items i WHERE i.receipt_key=r.key AND i.voided_at IS NULL
      ) ORDER BY r.date,r.key`);
    const { rows: deposits } = await tx.query(`
      SELECT d.id,to_char(d.date,'YYYY-MM-DD') AS date,d.reference,
      d.bank_cents AS "bankCents",d.fee_cents AS "feeCents",d.gross_cents AS "grossCents",
      d.void_reason AS "voidReason",array_agg(i.receipt_key ORDER BY i.receipt_key) AS "receiptKeys"
      FROM book_deposits d JOIN book_deposit_items i ON i.deposit_id=d.id
      WHERE d.date BETWEEN $1::date AND $2::date GROUP BY d.id ORDER BY d.date DESC,d.id DESC`, [from, to]);
    const rows = [...receipts, ...expenses].sort((a,b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key));
    const sum = (kinds: string[]) => rows.filter(r => !r.voidReason && kinds.includes(r.kind)).reduce((n,r) => n+r.amountCents, 0);
    const receivedCents = sum(["receipt"]), refundedCents = sum(["refund"]), expenseCents = sum(["expense","fee"]);
    return { from,to,receivedCents,refundedCents,expenseCents,
      netCashCents: receivedCents-refundedCents-expenseCents,rows,unmatchedReceipts,deposits };
  });
  res.json(GetBookkeepingResponse.parse(result));
});

router.post("/admin/bookkeeping/expenses", async (req, res) => {
  const parsed = expenseInput.safeParse(req.body);
  if (!parsed.success) throw new BookError(400, "Provide a valid paid date, category, payee, reference, whole-cent amount and confirm this expense was already paid.");
  const d = parsed.data;
  await transaction(async tx => {
    await lock(tx);
    const { rows: [previous] } = await tx.query("SELECT * FROM book_expenses WHERE request_id=$1", [d.requestId]);
    if (previous) {
      const { rows: [same] } = await tx.query(`SELECT id FROM book_expenses WHERE request_id=$1 AND date=$2::date
        AND category=$3 AND payee=$4 AND reference=$5 AND amount_cents=$6 AND method=$7`,
      [d.requestId,d.date,d.category,d.payee,d.reference,d.amountCents,d.method]);
      if (!same) throw new BookError(409, "This request ID was used for a different expense. Refresh before creating another entry.");
      return;
    }
    await tx.query(`INSERT INTO book_expenses(request_id,date,category,payee,reference,amount_cents,method)
      VALUES($1,$2,$3,$4,$5,$6,$7)`, [d.requestId,d.date,d.category,d.payee,d.reference,d.amountCents,d.method]);
  });
  res.json({ success: true });
});

router.post("/admin/bookkeeping/deposits", async (req, res) => {
  const parsed = depositInput.safeParse(req.body);
  if (!parsed.success) throw new BookError(400, "Provide a valid deposit date, bank reference, whole-cent amounts and unique receipts; confirm the bank deposit was verified.");
  const d = parsed.data;
  const keys = [...d.receiptKeys].sort();
  await transaction(async tx => {
    await lock(tx);
    const { rows: [previous] } = await tx.query(`SELECT id FROM book_deposits WHERE request_id=$1`, [d.requestId]);
    if (previous) {
      const { rows: [same] } = await tx.query(`SELECT id FROM book_deposits WHERE request_id=$1 AND date=$2::date
        AND reference=$3 AND bank_cents=$4 AND fee_cents=$5`, [d.requestId,d.date,d.reference,d.bankCents,d.feeCents]);
      const { rows: items } = await tx.query("SELECT receipt_key FROM book_deposit_items WHERE deposit_id=$1 ORDER BY receipt_key", [previous.id]);
      if (!same || JSON.stringify(items.map(i => i.receipt_key)) !== JSON.stringify(keys)) throw new BookError(409, "This request ID was used for a different deposit.");
      return;
    }
    const { rows: receipts } = await tx.query<{ key: string; date: string; amountCents: number }>(
      `SELECT * FROM (${receiptSql}) r WHERE r.kind='receipt' AND r.key=ANY($1::text[])`, [keys]);
    if (receipts.length !== keys.length) throw new BookError(409, "One or more selected receipts no longer exist or are not payments.");
    const error = depositError(d, receipts);
    if (error) throw new BookError(409, error);
    const { rows: used } = await tx.query("SELECT receipt_key FROM book_deposit_items WHERE receipt_key=ANY($1::text[]) AND voided_at IS NULL", [keys]);
    if (used.length) throw new BookError(409, "A selected receipt is already matched. Refresh the list.");
    const { rows: refs } = await tx.query("SELECT id FROM book_deposits WHERE lower(reference)=lower($1) AND voided_at IS NULL", [d.reference]);
    if (refs.length) throw new BookError(409, "This bank reference is already matched. Use the unique reference from your bank statement.");
    const { rows: [deposit] } = await tx.query(`INSERT INTO book_deposits(request_id,date,reference,bank_cents,fee_cents,gross_cents)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING id`, [d.requestId,d.date,d.reference,d.bankCents,d.feeCents,d.bankCents+d.feeCents]);
    for (const key of keys) await tx.query("INSERT INTO book_deposit_items(deposit_id,receipt_key) VALUES($1,$2)", [deposit.id,key]);
  });
  res.json({ success: true });
});

for (const kind of ["expenses", "deposits"] as const) {
  router.post(`/admin/bookkeeping/${kind}/:id/void`, async (req, res) => {
    const id = validId(req.params.id);
    const parsed = bookVoidInput.safeParse(req.body);
    if (!parsed.success) throw new BookError(400, "A reason is required to retain the correction history.");
    const table = kind === "expenses" ? "book_expenses" : "book_deposits";
    await transaction(async tx => {
      await lock(tx);
      const { rows: [row] } = await tx.query(`SELECT voided_at FROM ${table} WHERE id=$1 FOR UPDATE`, [id]);
      if (!row) throw new BookError(404, "Record not found");
      if (row.voided_at) return;
      await tx.query(`UPDATE ${table} SET voided_at=now(),void_reason=$2 WHERE id=$1`, [id, parsed.data.reason]);
      if (kind === "deposits") await tx.query("UPDATE book_deposit_items SET voided_at=now() WHERE deposit_id=$1", [id]);
    });
    res.json({ success: true });
  });
}
router.use((err: Error, req: import("express").Request, res: import("express").Response, _next: import("express").NextFunction) => {
  if (err instanceof BookError) { res.status(err.status).json({ error: err.message }); return; }
  req.log.error({ err }, "Bookkeeping request failed");
  res.status(500).json({ error: "Unable to save bookkeeping. Retry the unchanged entry safely." });
});
export default router;
