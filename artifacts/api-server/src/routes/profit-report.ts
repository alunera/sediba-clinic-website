import { Router } from "express";
import { GetProfitReportResponse } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/admin-auth";
import { receiptSql } from "../lib/bookkeeping";
import { validReportDates } from "../lib/sales";
import { stockTransaction } from "../lib/stock";
import { productSummary } from "../lib/profit-report";

const router = Router();
router.get("/admin/profit-report",requireAdmin,async(req,res)=>{
  const {from,to}=req.query;
  if(typeof from!=="string" || typeof to!=="string" || !validReportDates(from,to)) {
    res.status(400).json({error:"Choose valid dates covering no more than 367 days."});return;
  }
  const report=await stockTransaction(async tx=>{
    await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    const {rows:[receipts]}=await tx.query<{received: string;refunded:string}>(`
      SELECT COALESCE(SUM("amountCents") FILTER(WHERE kind='receipt'),0)::text received,
        COALESCE(SUM("amountCents") FILTER(WHERE kind='refund'),0)::text refunded
      FROM (${receiptSql}) r WHERE r.date BETWEEN $1 AND $2`,[from,to]);
    const {rows:expenses}=await tx.query<{category:string;amountCents:number}>(`
      SELECT category,SUM(amount)::float8 AS "amountCents" FROM (
        SELECT category,amount_cents AS amount FROM book_expenses
          WHERE date BETWEEN $1::date AND $2::date AND voided_at IS NULL
        UNION ALL
        SELECT 'bank_fees',fee_cents FROM book_deposits
          WHERE date BETWEEN $1::date AND $2::date AND voided_at IS NULL
      ) e GROUP BY category HAVING SUM(amount)>0 ORDER BY category`,[from,to]);
    const {rows:sales}=await tx.query<Parameters<typeof productSummary>[0][number] & {refunded:boolean}>(`
      SELECT s.items,EXISTS(SELECT 1 FROM clinic_sale_entries e WHERE e.sale_id=s.id AND e.kind='refund') AS refunded
      FROM clinic_sales s WHERE s.voided_at IS NULL
        AND s.created_at >= ($1::date::timestamp AT TIME ZONE 'Africa/Johannesburg')
        AND s.created_at < (($2::date+1)::timestamp AT TIME ZONE 'Africa/Johannesburg')
      ORDER BY s.id`,[from,to]);
    const receivedCents=Number(receipts!.received),refundedCents=Number(receipts!.refunded);
    const expenseCents=expenses.reduce((s,e)=>s+e.amountCents,0);
    return {from,to,receivedCents,refundedCents,netReceiptsCents:receivedCents-refundedCents,
      expenseCents,cashProfitCents:receivedCents-refundedCents-expenseCents,expenses,...productSummary(sales),
      refundedSaleCount:sales.filter(s=>s.refunded && s.items.some(i=>i.kind==="product")).length};
  });
  res.json(GetProfitReportResponse.parse(report));
});
export default router;
