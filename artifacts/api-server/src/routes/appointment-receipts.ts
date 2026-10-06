import { Router } from "express";
import { db, appointmentsTable, paymentsTable, appointmentRefundsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { RecordAppointmentReceiptBody, GetAppointmentReceiptsResponse } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/admin-auth";
import { bookingBalance, readBookingPayments, readBookingRefunds, receiptBlockedReason } from "../lib/booking-receipts";
import { refundBalance, refundInput, refundError } from "../lib/appointment-refunds";

const router = Router();
router.use("/admin/appointments/:id/receipts", requireAdmin);
router.use("/admin/appointments/:id/refunds", requireAdmin);
class ReceiptError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function idOf(raw: unknown) {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) throw new ReceiptError(400, "Invalid appointment ID");
  return id;
}
function present(appt: typeof appointmentsTable.$inferSelect, attempts: Awaited<ReturnType<typeof readBookingPayments>>, refunds: Awaited<ReturnType<typeof readBookingRefunds>>) {
  const balance = bookingBalance(appt.totalAmountCents, attempts);
  return GetAppointmentReceiptsResponse.parse({
    appointmentId: appt.id, bookingStatus: appt.status, totalCents: appt.totalAmountCents,
    ...balance,
    ...refundBalance(balance.paidCents, refunds),
    checkoutExceptions: attempts.filter(p => p.provider === "yoco" && p.status !== "complete").map(p => ({
      paymentId: p.id, attemptReference: p.checkoutId, checkoutReference: p.providerCheckoutId ?? "",
      status: p.status, amountCents: p.amountCents, createdAt: p.createdAt.toISOString(),
    })),
    refunds: refunds.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })),
    blockedReason: receiptBlockedReason(appt.status, appt.totalAmountCents, attempts),
    receipts: attempts.filter(p => p.status === "complete").map(p => ({
      id: p.id, amountCents: p.amountCents, method: p.provider === "in_salon" ? p.method : "yoco",
      reference: p.receiptReference ?? p.providerPaymentId ?? "Verified online payment",
      createdAt: p.updatedAt.toISOString(),
      refundedCents: refundBalance(p.amountCents, refunds.filter(r => r.paymentId === p.id)).refundedCents,
      refundableCents: refundBalance(p.amountCents, refunds.filter(r => r.paymentId === p.id)).netReceiptsCents,
    })),
  });
}
router.get("/admin/appointments/:id/receipts", async (req, res) => {
  const id = idOf(req.params.id);
  // The history and totals must describe one database snapshot.
  const result = await db.transaction(async tx => {
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`);
    const [appt] = await tx.select().from(appointmentsTable).where(eq(appointmentsTable.id, id));
    if (!appt) throw new ReceiptError(404, "Appointment not found");
    return present(appt, await readBookingPayments(tx, id), await readBookingRefunds(tx, id));
  });
  res.json(result);
});
router.post("/admin/appointments/:id/receipts", async (req, res) => {
  const id = idOf(req.params.id);
  const input = RecordAppointmentReceiptBody.safeParse(req.body);
  if (!input.success || !Number.isSafeInteger(input.data.amountCents) || input.data.received !== true || !input.data.reference.trim()) {
    throw new ReceiptError(400, "Confirm money was received and provide a positive whole-cent amount, method and reference.");
  }
  const data = input.data;
  const reference = data.reference.trim();
  const result = await db.transaction(async tx => {
    // Serialize even request IDs accidentally reused across appointments.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`receipt:${data.requestId}`}))`);
    let [appt] = await tx.select().from(appointmentsTable).where(eq(appointmentsTable.id, id));
    if (!appt) throw new ReceiptError(404, "Appointment not found");
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`slot:${appt.date} ${appt.time}`}))`);
    [appt] = await tx.select().from(appointmentsTable).where(eq(appointmentsTable.id, id));
    const [previous] = await tx.select().from(paymentsTable).where(eq(paymentsTable.checkoutId, `salon:${data.requestId}`));
    const attempts = await readBookingPayments(tx, id);
    if (previous) {
      if (previous.appointmentId !== id || previous.amountCents !== data.amountCents || previous.method !== data.method || previous.receiptReference !== reference) {
        throw new ReceiptError(409, "This request ID was already used for a different payment.");
      }
      return present(appt!, attempts, await readBookingRefunds(tx, id));
    }
    const blocked = receiptBlockedReason(appt!.status, appt!.totalAmountCents, attempts);
    if (blocked) throw new ReceiptError(409, blocked);
    const balance = bookingBalance(appt!.totalAmountCents, attempts);
    if (data.amountCents > balance.outstandingCents) throw new ReceiptError(409, "Payment exceeds the remaining balance. Refresh the appointment.");
    const [receipt] = await tx.insert(paymentsTable).values({
      appointmentId: id, bookingRef: appt!.bookingRef, checkoutId: `salon:${data.requestId}`,
      amountCents: data.amountCents, provider: "in_salon", method: data.method,
      receiptReference: reference, status: "complete",
    }).returning();
    const after = [...attempts, receipt!];
    const settled = bookingBalance(appt!.totalAmountCents, after).outstandingCents === 0;
    // Never undo completed/no-show states just because a debt is settled afterwards.
    if (settled && ["pending", "pending_payment", "payment_failed"].includes(appt!.status)) {
      [appt] = await tx.update(appointmentsTable).set({ status: "confirmed" }).where(eq(appointmentsTable.id, id)).returning();
    }
    return present(appt!, after, await readBookingRefunds(tx, id));
  });
  res.json(result);
});
router.post("/admin/appointments/:id/refunds", async (req, res) => {
  const id = idOf(req.params.id);
  const parsed = refundInput.safeParse(req.body);
  if (!parsed.success) throw new ReceiptError(400, "Select a payment and valid whole-cent amount, enter a reason and reference, and confirm the money was already returned.");
  const d = parsed.data;
  const result = await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`refund:${d.requestId}`}))`);
    const [appt] = await tx.select().from(appointmentsTable).where(eq(appointmentsTable.id, id));
    if (!appt) throw new ReceiptError(404, "Appointment not found");
    // Every refund of this receipt serializes on the original payment row.
    const [payment] = await tx.select().from(paymentsTable).where(eq(paymentsTable.id, d.paymentId)).for("update");
    if (!payment || payment.appointmentId !== id) throw new ReceiptError(400, "The selected payment does not belong to this appointment.");
    const [previous] = await tx.select().from(appointmentRefundsTable).where(eq(appointmentRefundsTable.requestId, d.requestId));
    const attempts = await readBookingPayments(tx, id);
    const refunds = await readBookingRefunds(tx, id);
    if (previous) {
      if (previous.paymentId !== d.paymentId || previous.amountCents !== d.amountCents || previous.method !== d.method ||
        previous.reference !== d.reference || previous.reason !== d.reason) {
        throw new ReceiptError(409, "This request ID was already used for a different refund.");
      }
      return present(appt, attempts, refunds);
    }
    const refundedCents = refundBalance(payment.amountCents, refunds.filter(r => r.paymentId === d.paymentId)).refundedCents;
    const error = refundError(payment, refundedCents, d);
    if (error) throw new ReceiptError(409, error);
    const [refund] = await tx.insert(appointmentRefundsTable).values({
      requestId: d.requestId, paymentId: d.paymentId, amountCents: d.amountCents,
      method: d.method, reference: d.reference, reason: d.reason,
    }).returning();
    // No booking/payment status updates, card-provider calls or message sends here.
    return present(appt, attempts, [...refunds, refund!]);
  });
  res.json(result);
});
router.use((err: Error, req: import("express").Request, res: import("express").Response, _next: import("express").NextFunction) => {
  if (err instanceof ReceiptError) { res.status(err.status).json({ error: err.message }); return; }
  const cause = (err as Error & { cause?: { code?: string }; code?: string });
  if (cause.code === "23505" || cause.cause?.code === "23505") {
    res.status(409).json({ error: "This refund reference was already recorded. Refresh the history before recording another." }); return;
  }
  req.log.error({ err }, "Appointment receipt failed");
  res.status(500).json({ error: "Unable to record payment. Retry the unchanged form safely." });
});
export default router;
