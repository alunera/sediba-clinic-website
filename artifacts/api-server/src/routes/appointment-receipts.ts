import { Router } from "express";
import { db, appointmentsTable, paymentsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { RecordAppointmentReceiptBody, GetAppointmentReceiptsResponse } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/admin-auth";
import { bookingBalance, readBookingPayments, receiptBlockedReason } from "../lib/booking-receipts";

const router = Router();
router.use("/admin/appointments/:id/receipts", requireAdmin);
class ReceiptError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function idOf(raw: unknown) {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) throw new ReceiptError(400, "Invalid appointment ID");
  return id;
}
function present(appt: typeof appointmentsTable.$inferSelect, attempts: Awaited<ReturnType<typeof readBookingPayments>>) {
  return GetAppointmentReceiptsResponse.parse({
    appointmentId: appt.id, bookingStatus: appt.status, totalCents: appt.totalAmountCents,
    ...bookingBalance(appt.totalAmountCents, attempts),
    blockedReason: receiptBlockedReason(appt.status, appt.totalAmountCents, attempts),
    receipts: attempts.filter(p => p.status === "complete").map(p => ({
      id: p.id, amountCents: p.amountCents, method: p.provider === "in_salon" ? p.method : "yoco",
      reference: p.receiptReference ?? p.providerPaymentId ?? "Verified online payment",
      createdAt: p.updatedAt.toISOString(),
    })),
  });
}
router.get("/admin/appointments/:id/receipts", async (req, res) => {
  const id = idOf(req.params.id);
  const [appt] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, id));
  if (!appt) throw new ReceiptError(404, "Appointment not found");
  res.json(present(appt, await readBookingPayments(db, id)));
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
      return present(appt!, attempts);
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
    return present(appt!, after);
  });
  res.json(result);
});
router.use((err: Error, req: import("express").Request, res: import("express").Response, _next: import("express").NextFunction) => {
  if (err instanceof ReceiptError) { res.status(err.status).json({ error: err.message }); return; }
  req.log.error({ err }, "Appointment receipt failed");
  res.status(500).json({ error: "Unable to record payment. Retry the unchanged form safely." });
});
export default router;
