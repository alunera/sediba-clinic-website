import { CreateBookExpenseBody, CreateBookDepositBody, VoidBookExpenseBody } from "@workspace/api-zod";
import { validReportDates } from "./sales";

export function clinicToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
const paidDate = (d: string) => validReportDates(d, d) && d <= clinicToday();
export const expenseInput = CreateBookExpenseBody.refine(d =>
  paidDate(d.date) && Number.isSafeInteger(d.amountCents) && d.paid === true &&
  !!d.payee.trim() && !!d.reference.trim())
  .transform(d => ({ ...d, payee: d.payee.trim(), reference: d.reference.trim() }));
export const depositInput = CreateBookDepositBody.refine(d =>
  paidDate(d.date) && Number.isSafeInteger(d.bankCents) && Number.isSafeInteger(d.feeCents) &&
  d.verified === true && !!d.reference.trim() &&
  d.receiptKeys.every(k => /^(sale|booking):[1-9]\d*$/.test(k)) &&
  new Set(d.receiptKeys).size === d.receiptKeys.length)
  .transform(d => ({ ...d, reference: d.reference.trim() }));
export const bookVoidInput = VoidBookExpenseBody.refine(d => !!d.reason.trim()).transform(d => ({ reason: d.reason.trim() }));
export function depositError(data: { date: string; bankCents: number; feeCents: number }, receipts: { date: string; amountCents: number }[]) {
  const total = receipts.reduce((sum, r) => sum + r.amountCents, 0);
  if (!Number.isSafeInteger(total) || total > 100000000) return "Selected receipts exceed the supported deposit limit.";
  if (total !== data.bankCents + data.feeCents) return "Bank deposit plus fees must equal the selected receipts exactly.";
  if (receipts.some(r => r.date > data.date)) return "A deposit cannot precede a selected receipt.";
  return null;
}

// Reuse original immutable receipts; a bank deposit is a transfer, never new income.
export const receiptSql = `
  SELECT 'sale:' || e.id AS key, to_char(e.created_at AT TIME ZONE 'Africa/Johannesburg','YYYY-MM-DD') AS date,
    CASE WHEN e.kind='payment' THEN 'receipt' ELSE 'refund' END AS kind,
    s.client_name AS description, 'SED-' || lpad(s.id::text,6,'0') AS reference,
    'manual_sale' AS category, e.method, e.amount_cents AS "amountCents", '' AS "voidReason"
  FROM clinic_sale_entries e JOIN clinic_sales s ON s.id=e.sale_id
  UNION ALL
  SELECT 'booking:' || p.id, to_char(p.updated_at AT TIME ZONE 'Africa/Johannesburg','YYYY-MM-DD'),
    'receipt', a.client_name, p.booking_ref, 'booking',
    CASE WHEN p.provider='in_salon' THEN p.method ELSE 'yoco' END, p.amount_cents, ''
  FROM payments p JOIN appointments a ON a.id=p.appointment_id WHERE p.status='complete'
  UNION ALL
  SELECT 'booking-refund:' || r.id, to_char(r.created_at AT TIME ZONE 'Africa/Johannesburg','YYYY-MM-DD'),
    'refund', a.client_name, p.booking_ref, 'booking', r.method, r.amount_cents, ''
  FROM appointment_refunds r JOIN payments p ON p.id=r.payment_id
  JOIN appointments a ON a.id=p.appointment_id
`;
