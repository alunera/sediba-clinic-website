import { CreateAdminSaleBody, AddAdminSaleEntryBody } from "@workspace/api-zod";

// Orval currently emits z.number() for OpenAPI integers. Enforce integer money at the boundary.
export const saleInput = CreateAdminSaleBody.refine(data =>
  Number.isSafeInteger(data.clientId) && data.items.every(item =>
    Number.isSafeInteger(item.quantity) && Number.isSafeInteger(item.unitPriceCents) &&
    (item.productId === undefined || (Number.isSafeInteger(item.productId) && item.kind === "product"))),
  { message: "Client ID, quantity and cents must be integers" });
export const saleEntryInput = AddAdminSaleEntryBody.refine(data => Number.isSafeInteger(data.amountCents),
  { message: "Amount in cents must be an integer" });

export type SaleItem = { description: string; kind: string; quantity: number; unitPriceCents: number };
export type Entry = { kind: string; amountCents: number };

export function saleTotal(items: SaleItem[]): number {
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  if (!Number.isSafeInteger(total) || total <= 0 || total > 100000000) {
    throw new Error("Sale total must be between R0.01 and R1,000,000.00");
  }
  return total;
}

export function saleBalance(total: number, entries: Entry[], voided: boolean) {
  const paidCents = entries.filter(e => e.kind === "payment").reduce((sum, e) => sum + e.amountCents, 0);
  const refundedCents = entries.filter(e => e.kind === "refund").reduce((sum, e) => sum + e.amountCents, 0);
  // A refund reverses a receipt, not the customer's debt: never reopen a fully paid sale.
  const outstandingCents = voided ? 0 : Math.max(0, total - paidCents);
  const status = voided ? "void" : refundedCents === paidCents && refundedCents > 0 ? "refunded"
    : refundedCents > 0 ? "partially_refunded" : paidCents === total ? "paid" : paidCents > 0 ? "part_paid" : "unpaid";
  return { paidCents, refundedCents, outstandingCents, status };
}

export function entryError(total: number, entries: Entry[], voided: boolean, entry: Entry): string | null {
  const balance = saleBalance(total, entries, voided);
  if (voided) return "A voided sale cannot receive payments or refunds";
  if (entry.kind === "payment" && entry.amountCents > balance.outstandingCents) return "Payment exceeds the outstanding balance";
  if (entry.kind === "refund" && entry.amountCents > balance.paidCents - balance.refundedCents) return "Refund exceeds the amount received less previous refunds";
  return null;
}

export function validReportDates(from: string, to: string) {
  const valid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  return valid(from) && valid(to) && from <= to && Date.parse(to) - Date.parse(from) <= 366 * 86400000;
}
