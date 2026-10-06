import { db, paymentsTable, appointmentRefundsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

type ReceiptAttempt = { status: string; amountCents: number; provider: string };
export function bookingBalance(totalCents: number, attempts: ReceiptAttempt[]) {
  const paidCents = attempts.filter(p => p.status === "complete").reduce((sum, p) => sum + p.amountCents, 0);
  return {
    paidCents, outstandingCents: Math.max(0, totalCents - paidCents),
    inSalon: attempts.some(p => p.provider === "in_salon" && p.status === "complete"),
  };
}
export function receiptBlockedReason(status: string, total: number, attempts: ReceiptAttempt[]) {
  const balance = bookingBalance(total, attempts);
  if (status === "cancelled") return "This appointment is cancelled. Reopen or reschedule it before collecting payment.";
  if (!balance.outstandingCents) return "This appointment has no outstanding balance.";
  // A return/cancel URL or failed payment event does not prove the hosted link is unusable.
  if (attempts.some(p => p.provider === "yoco" && p.status !== "complete")) {
    return "An online checkout was already issued or its creation is unresolved. Do not collect another payment until the clinic has reconciled that checkout with Yoco; this system cannot revoke its link.";
  }
  return "";
}
export type BookingTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function readBookingPayments(executor: BookingTransaction | typeof db, id: number) {
  return executor.select().from(paymentsTable).where(eq(paymentsTable.appointmentId, id)).orderBy(paymentsTable.id);
}
export async function readBookingRefunds(executor: BookingTransaction | typeof db, id: number) {
  const rows = await executor.select({ refund: appointmentRefundsTable }).from(appointmentRefundsTable)
    .innerJoin(paymentsTable, eq(appointmentRefundsTable.paymentId, paymentsTable.id))
    .where(eq(paymentsTable.appointmentId, id)).orderBy(appointmentRefundsTable.id);
  return rows.map(r => r.refund);
}
