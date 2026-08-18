import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import { appointmentsTable, paymentsTable, servicesTable } from "@workspace/db";
import { and, eq, lt, ne, sql } from "drizzle-orm";
import {
  buildPaymentForm,
  verifyItnSignature,
  confirmItnWithPayfast,
  payfastCredentials,
  payfastMode,
} from "../lib/payfast";
import { sendBookingConfirmation, scheduleReminderMessage } from "../lib/whatsapp";
import { logger } from "../lib/logger";

const router = Router();

/** Minutes a booking may sit in pending_payment before its slot is released. */
export const PENDING_PAYMENT_TTL_MIN = 30;

/**
 * Cancel pending_payment bookings older than the TTL so abandoned checkouts
 * release their slots. Safe to call concurrently.
 */
export async function releaseExpiredPendingBookings(): Promise<number> {
  const result = await db
    .update(appointmentsTable)
    .set({ status: "cancelled", notes: sql`COALESCE(${appointmentsTable.notes} || ' ', '') || '[auto] payment window expired'` })
    .where(
      and(
        sql`${appointmentsTable.status} IN ('pending_payment', 'payment_failed')`,
        lt(appointmentsTable.createdAt, sql`now() - interval '${sql.raw(String(PENDING_PAYMENT_TTL_MIN))} minutes'`)
      )
    )
    .returning({ id: appointmentsTable.id });
  if (result.length > 0) {
    logger.info({ count: result.length }, "[Payments] Released expired pending_payment bookings");
  }
  return result.length;
}

/** POST /payments/initiate — create a payment attempt for a pending booking. */
router.post("/payments/initiate", async (req, res): Promise<void> => {
  const bookingRef = String(req.body?.bookingRef ?? "");
  if (!/^SWC-[A-Z2-9]{8}$/.test(bookingRef)) {
    res.status(400).json({ error: "Invalid booking reference" });
    return;
  }

  const [appt] = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.bookingRef, bookingRef))
    .limit(1);
  if (!appt) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  if (appt.status === "confirmed") {
    res.status(409).json({ error: "This booking is already paid and confirmed." });
    return;
  }
  if (appt.status !== "pending_payment" && appt.status !== "payment_failed") {
    res.status(409).json({ error: "This booking is no longer payable. Please start a new booking." });
    return;
  }
  if (appt.totalAmountCents <= 0) {
    res.status(409).json({ error: "This booking does not require payment." });
    return;
  }

  const [service] = await db
    .select({ name: servicesTable.name })
    .from(servicesTable)
    .where(eq(servicesTable.id, appt.serviceId))
    .limit(1);

  const mPaymentId = randomUUID();
  await db.insert(paymentsTable).values({
    appointmentId: appt.id,
    bookingRef,
    mPaymentId,
    amountCents: appt.totalAmountCents,
  });

  const form = buildPaymentForm({
    mPaymentId,
    amountCents: appt.totalAmountCents,
    itemName: `Sediba — ${service?.name ?? "Treatment"} (${bookingRef})`,
    clientName: appt.clientName,
    clientEmail: appt.clientEmail,
    bookingRef,
  });

  res.json({ ...form, mode: payfastMode() });
});

/** GET /payments/status?ref= — polled by the return page until ITN lands. */
router.get("/payments/status", async (req, res): Promise<void> => {
  const ref = String(req.query.ref ?? "");
  if (!/^SWC-[A-Z2-9]{8}$/.test(ref)) {
    res.status(400).json({ error: "Invalid booking reference" });
    return;
  }
  const [appt] = await db
    .select({
      bookingStatus: appointmentsTable.status,
      totalAmountCents: appointmentsTable.totalAmountCents,
    })
    .from(appointmentsTable)
    .where(eq(appointmentsTable.bookingRef, ref))
    .limit(1);
  if (!appt) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  const payments = await db
    .select({ status: paymentsTable.status, updatedAt: paymentsTable.updatedAt })
    .from(paymentsTable)
    .where(eq(paymentsTable.bookingRef, ref))
    .orderBy(paymentsTable.id);
  const latest = payments[payments.length - 1];
  res.json({
    bookingStatus: appt.bookingStatus,
    paymentStatus: latest?.status ?? "none",
    amountCents: appt.totalAmountCents,
  });
});

/**
 * POST /payments/payfast/itn — PayFast server-to-server notification.
 * This is the ONLY place a booking is marked confirmed/paid.
 */
router.post("/payments/payfast/itn", async (req, res): Promise<void> => {
  // Process BEFORE acknowledging: if we crash mid-way, PayFast retries the
  // notification. Invalid/fraudulent payloads are still answered 200 so
  // PayFast stops retrying them; only genuine processing failures get a 500.
  const body = req.body as Record<string, string>;
  const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? "";

  try {
    const mPaymentId = body.m_payment_id ?? "";
    const pfPaymentId = body.pf_payment_id ?? "";
    const paymentStatus = (body.payment_status ?? "").toUpperCase();

    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.mPaymentId, mPaymentId))
      .limit(1);
    if (!payment) {
      logger.error({ mPaymentId }, "[PayFast ITN] Unknown m_payment_id — ignoring");
      res.status(200).send("OK");
      return;
    }
    if (payment.status === "complete") {
      logger.info({ mPaymentId }, "[PayFast ITN] Duplicate notification for completed payment — ignoring");
      res.status(200).send("OK");
      return;
    }

    // 1. Signature check (received field order)
    if (!verifyItnSignature(body)) {
      logger.error({ mPaymentId }, "[PayFast ITN] Signature mismatch — rejecting");
      res.status(200).send("OK");
      return;
    }
    // 2. Merchant check
    const { merchantId } = payfastCredentials();
    if (body.merchant_id !== merchantId) {
      logger.error({ mPaymentId, got: body.merchant_id }, "[PayFast ITN] merchant_id mismatch — rejecting");
      res.status(200).send("OK");
      return;
    }
    // 3. Amount check (allow 1c rounding tolerance; NaN must not pass)
    const grossRands = parseFloat(body.amount_gross ?? "");
    const gross = Number.isFinite(grossRands) ? Math.round(grossRands * 100) : NaN;
    if (!Number.isFinite(gross) || Math.abs(gross - payment.amountCents) > 1) {
      logger.error(
        { mPaymentId, expected: payment.amountCents, got: gross },
        "[PayFast ITN] Amount mismatch — rejecting"
      );
      await db
        .update(paymentsTable)
        .set({ status: "failed", pfPaymentId, rawItn: rawBody, updatedAt: new Date() })
        .where(eq(paymentsTable.id, payment.id));
      res.status(200).send("OK");
      return;
    }
    // 4. Server-to-server confirmation with PayFast. A missing raw body means
    // we cannot validate — reject rather than trusting the payload.
    if (!rawBody) {
      logger.error({ mPaymentId }, "[PayFast ITN] Raw body unavailable — cannot validate, rejecting");
      res.status(200).send("OK");
      return;
    }
    if (!(await confirmItnWithPayfast(rawBody))) {
      logger.error({ mPaymentId }, "[PayFast ITN] PayFast validate returned INVALID — rejecting");
      res.status(200).send("OK");
      return;
    }

    if (paymentStatus !== "COMPLETE") {
      const mapped = paymentStatus === "CANCELLED" ? "cancelled" : "failed";
      await db
        .update(paymentsTable)
        .set({ status: mapped, pfPaymentId, rawItn: rawBody, updatedAt: new Date() })
        .where(eq(paymentsTable.id, payment.id));
      // Reflect failure on the booking, but never downgrade a confirmed one.
      await db
        .update(appointmentsTable)
        .set({ status: "payment_failed" })
        .where(and(eq(appointmentsTable.id, payment.appointmentId), eq(appointmentsTable.status, "pending_payment")));
      logger.info({ mPaymentId, paymentStatus }, "[PayFast ITN] Non-complete payment recorded");
      res.status(200).send("OK");
      return;
    }

    // COMPLETE — confirm the booking under the slot's advisory lock.
    const outcome = await db.transaction(async (tx) => {
      const [appt] = await tx
        .select()
        .from(appointmentsTable)
        .where(eq(appointmentsTable.id, payment.appointmentId))
        .limit(1);
      if (!appt) return { kind: "missing" as const };

      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`slot:${appt.date} ${appt.time}`}))`);

      // One-winner transition: only the ITN that flips the payment row to
      // complete performs confirmation + messaging. Concurrent duplicates
      // update zero rows and stop here.
      const won = await tx
        .update(paymentsTable)
        .set({ status: "complete", pfPaymentId, rawItn: rawBody, updatedAt: new Date() })
        .where(and(eq(paymentsTable.id, payment.id), ne(paymentsTable.status, "complete")))
        .returning({ id: paymentsTable.id });
      if (won.length === 0) return { kind: "duplicate" as const };

      if (appt.status === "pending_payment" || appt.status === "payment_failed") {
        await tx.update(appointmentsTable).set({ status: "confirmed" }).where(eq(appointmentsTable.id, appt.id));
        return { kind: "confirmed" as const, appt };
      }
      if (appt.status === "confirmed") return { kind: "already" as const, appt };

      // Booking was auto-cancelled (expired) before payment landed — try to
      // resurrect it if the slot is still free.
      const [conflict] = await tx
        .select({ id: appointmentsTable.id })
        .from(appointmentsTable)
        .where(
          and(
            eq(appointmentsTable.date, appt.date),
            eq(appointmentsTable.time, appt.time),
            ne(appointmentsTable.status, "cancelled"),
            ne(appointmentsTable.id, appt.id)
          )
        )
        .limit(1);
      if (!conflict) {
        await tx.update(appointmentsTable).set({ status: "confirmed" }).where(eq(appointmentsTable.id, appt.id));
        return { kind: "resurrected" as const, appt };
      }
      return { kind: "paid_but_slot_taken" as const, appt };
    });

    if (outcome.kind === "confirmed" || outcome.kind === "resurrected") {
      const appt = outcome.appt;
      const [service] = await db
        .select({ name: servicesTable.name })
        .from(servicesTable)
        .where(eq(servicesTable.id, appt.serviceId))
        .limit(1);
      const details = {
        appointmentId: appt.id,
        bookingRef: appt.bookingRef,
        clientName: appt.clientName,
        clientWhatsapp: appt.clientWhatsapp,
        serviceName: service?.name ?? "",
        date: appt.date,
        time: appt.time,
      };
      void sendBookingConfirmation(details);
      if (appt.reminderScheduledFor) {
        scheduleReminderMessage(details, appt.reminderScheduledFor);
      }
      logger.info({ mPaymentId, bookingRef: appt.bookingRef }, "[PayFast ITN] Booking confirmed after payment");
    } else if (outcome.kind === "paid_but_slot_taken") {
      logger.error(
        { mPaymentId, bookingRef: outcome.appt.bookingRef, date: outcome.appt.date, time: outcome.appt.time },
        "[PayFast ITN] PAYMENT RECEIVED but slot was re-booked after the payment window expired. " +
          "Manual action required: contact the client to reschedule or refund."
      );
    }
    res.status(200).send("OK");
  } catch (err) {
    // Genuine processing failure — let PayFast retry the notification.
    logger.error({ err }, "[PayFast ITN] Handler failed — returning 500 so PayFast retries");
    if (!res.headersSent) res.status(500).send("ERROR");
  }
});

export default router;
