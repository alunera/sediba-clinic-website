import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import { appointmentsTable, paymentsTable, servicesTable } from "@workspace/db";
import { and, eq, lt, ne, sql } from "drizzle-orm";
import { assertYocoReady, createYocoCheckout, verifyYocoWebhook } from "../lib/yoco";
import { sendBookingConfirmation, scheduleReminderMessage } from "../lib/whatsapp";
import { logger } from "../lib/logger";
import { bookingBalance, readBookingPayments } from "../lib/booking-receipts";

const router = Router();
export const PENDING_PAYMENT_TTL_MIN = 30;

export async function releaseExpiredPendingBookings(): Promise<number> {
  const expired = await db.select({
    id: appointmentsTable.id,
    date: appointmentsTable.date,
    time: appointmentsTable.time,
  }).from(appointmentsTable)
    .where(and(
      sql`${appointmentsTable.status} IN ('pending_payment', 'payment_failed')`,
      sql`NOT EXISTS (SELECT 1 FROM payments p WHERE p.appointment_id = ${appointmentsTable.id} AND p.status = 'complete')`,
      lt(appointmentsTable.createdAt, sql`now() - interval '${sql.raw(String(PENDING_PAYMENT_TTL_MIN))} minutes'`),
    ));
  let released = 0;
  for (const row of expired) {
    released += await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`slot:${row.date} ${row.time}`}))`);
      const result = await tx.update(appointmentsTable).set({
        status: "cancelled",
        notes: sql`COALESCE(${appointmentsTable.notes} || ' ', '') || '[auto] payment window expired'`,
      }).where(and(
        eq(appointmentsTable.id, row.id),
        sql`${appointmentsTable.status} IN ('pending_payment', 'payment_failed')`,
        sql`NOT EXISTS (SELECT 1 FROM payments p WHERE p.appointment_id = ${appointmentsTable.id} AND p.status = 'complete')`,
        lt(appointmentsTable.createdAt, sql`now() - interval '${sql.raw(String(PENDING_PAYMENT_TTL_MIN))} minutes'`),
      )).returning({ id: appointmentsTable.id });
      return result.length;
    });
  }
  if (released) logger.info({ count: released }, "[Payments] Released expired bookings");
  return released;
}

router.post("/payments/initiate", async (req, res): Promise<void> => {
  const bookingRef = String(req.body?.bookingRef ?? "");
  if (!/^SWC-[A-Z2-9]{8}$/.test(bookingRef)) {
    res.status(400).json({ error: "Invalid booking reference" });
    return;
  }
  const [appt] = await db.select().from(appointmentsTable)
    .where(eq(appointmentsTable.bookingRef, bookingRef)).limit(1);
  if (!appt) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  const attemptId = randomUUID();
  const reservation = await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`slot:${appt.date} ${appt.time}`}))`);
    const [current] = await tx.select().from(appointmentsTable).where(eq(appointmentsTable.id, appt.id));
    if (!current) return { error: "Booking not found." };
    const attempts = await readBookingPayments(tx, appt.id);
    const balance = bookingBalance(current.totalAmountCents, attempts);
    if (!balance.outstandingCents) return { error: "This booking has no outstanding balance." };
    if (balance.inSalon) return { error: "An in-salon payment is recorded. Please settle the remaining balance at the clinic." };
    if (!["pending_payment", "payment_failed"].includes(current.status)) return { error: "This booking is no longer payable online." };
    // Never issue another hosted link while the first can still be used.
    const existing = attempts.find(p => p.provider === "yoco" && p.status !== "complete");
    if (existing) return existing.checkoutUrl
      ? { url: existing.checkoutUrl }
      : { error: "An online checkout is already being created or needs reconciliation. Please contact the clinic before paying again." };
    try { assertYocoReady(); } catch { return { unavailable: true }; }
    // Persist BEFORE contacting Yoco: if creation succeeds but the response is lost,
    // the durable reservation still blocks a competing in-salon payment.
    await tx.insert(paymentsTable).values({
      appointmentId: appt.id, bookingRef, checkoutId: attemptId,
      amountCents: balance.outstandingCents, provider: "yoco", status: "creating",
    });
    return { amount: balance.outstandingCents };
  });
  if ("error" in reservation) { res.status(409).json({ error: reservation.error }); return; }
  if ("unavailable" in reservation) { res.status(503).json({ error: "Online payments are temporarily unavailable." }); return; }
  if ("url" in reservation) {
    res.json({ url: reservation.url, mode: process.env.YOCO_MODE === "live" ? "live" : "test" }); return;
  }
  try {
    const [service] = await db.select({ name: servicesTable.name }).from(servicesTable).where(eq(servicesTable.id, appt.serviceId));
    const checkout = await createYocoCheckout({
      checkoutId: attemptId, bookingRef, amountCents: reservation.amount!,
      itemName: `Sediba — ${service?.name ?? "Treatment"} (${bookingRef})`,
    });
    await db.update(paymentsTable).set({ providerCheckoutId: checkout.id, checkoutUrl: checkout.redirectUrl })
      .where(eq(paymentsTable.checkoutId, attemptId));
    await db.update(paymentsTable).set({ status: "created" })
      .where(and(eq(paymentsTable.checkoutId, attemptId), eq(paymentsTable.status, "creating")));
    res.json({ url: checkout.redirectUrl, mode: checkout.mode });
  } catch (err) {
    logger.error({ err, bookingRef }, "[Payments] Checkout creation outcome uncertain");
    res.status(503).json({ error: "Checkout creation could not be confirmed. Contact the clinic before trying another payment method." });
  }
});

router.get("/payments/status", async (req, res): Promise<void> => {
  const ref = String(req.query.ref ?? "");
  if (!/^SWC-[A-Z2-9]{8}$/.test(ref)) {
    res.status(400).json({ error: "Invalid booking reference" });
    return;
  }
  const [appt] = await db.select({
    id: appointmentsTable.id,
    bookingStatus: appointmentsTable.status,
    totalAmountCents: appointmentsTable.totalAmountCents,
  }).from(appointmentsTable).where(eq(appointmentsTable.bookingRef, ref)).limit(1);
  if (!appt) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  const attempts = await readBookingPayments(db, appt.id);
  const balance = bookingBalance(appt.totalAmountCents, attempts);
  res.json({
    bookingStatus: appt.bookingStatus,
    paymentStatus: balance.paidCents > 0
      ? (balance.outstandingCents === 0 ? "complete" : "partial")
      : attempts.at(-1)?.status ?? "none",
    amountCents: appt.totalAmountCents,
    ...balance,
  });
});

router.post("/payments/yoco/webhook", async (req, res): Promise<void> => {
  const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? "";
  try {
    if (!verifyYocoWebhook({
      rawBody,
      webhookId: req.header("webhook-id"),
      timestamp: req.header("webhook-timestamp"),
      signature: req.header("webhook-signature"),
    })) {
      logger.error("[Yoco webhook] Invalid signature or expired timestamp");
      res.status(403).send("INVALID");
      return;
    }

    const event = req.body as {
      id?: string;
      type?: "payment.succeeded" | "payment.failed";
      payload?: {
        id?: string;
        amount?: number;
        currency?: string;
        metadata?: { bookingRef?: string; checkoutId?: string };
      };
    };
    const bookingRef = event.payload?.metadata?.bookingRef;
    const attemptId = event.payload?.metadata?.checkoutId;
    if (!bookingRef || !attemptId || !event.payload?.id || !event.id) {
      res.status(200).send("IGNORED");
      return;
    }
    const [payment] = await db.select().from(paymentsTable)
      .where(and(eq(paymentsTable.checkoutId, attemptId), eq(paymentsTable.bookingRef, bookingRef), eq(paymentsTable.provider, "yoco")))
      .limit(1);
    if (!payment) {
      logger.error({ bookingRef }, "[Yoco webhook] Unknown booking");
      res.status(200).send("IGNORED");
      return;
    }
    if (event.payload.amount !== payment.amountCents || event.payload.currency !== "ZAR") {
      logger.error({ bookingRef }, "[Yoco webhook] Amount or currency mismatch");
      res.status(403).send("INVALID");
      return;
    }
    if (payment.status === "complete") {
      res.status(200).send("OK");
      return;
    }
    const [alreadyProcessed] = await db.select({ id: paymentsTable.id }).from(paymentsTable)
      .where(eq(paymentsTable.webhookEventId, event.id)).limit(1);
    if (alreadyProcessed) {
      res.status(200).send("OK");
      return;
    }

    if (event.type === "payment.failed") {
      await db.transaction(async (tx) => {
        const [appt] = await tx.select().from(appointmentsTable).where(eq(appointmentsTable.id, payment.appointmentId));
        if (!appt) return;
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`slot:${appt.date} ${appt.time}`}))`);
        await tx.update(paymentsTable).set({
          status: "failed", providerPaymentId: event.payload!.id, webhookEventId: event.id,
          rawItn: rawBody, updatedAt: new Date(),
        }).where(and(eq(paymentsTable.id, payment.id), sql`${paymentsTable.webhookEventId} IS NULL`));
        await tx.update(appointmentsTable).set({ status: "payment_failed" })
          .where(and(eq(appointmentsTable.id, payment.appointmentId), eq(appointmentsTable.status, "pending_payment")));
      });
      res.status(200).send("OK");
      return;
    }
    if (event.type !== "payment.succeeded") {
      res.status(200).send("IGNORED");
      return;
    }

    const outcome = await db.transaction(async (tx) => {
      let [appt] = await tx.select().from(appointmentsTable)
        .where(eq(appointmentsTable.id, payment.appointmentId)).limit(1);
      if (!appt) return { kind: "missing" as const };
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`slot:${appt.date} ${appt.time}`}))`);
      [appt] = await tx.select().from(appointmentsTable)
        .where(eq(appointmentsTable.id, payment.appointmentId)).limit(1);
      if (!appt) return { kind: "missing" as const };
      const won = await tx.update(paymentsTable).set({
        status: "complete", providerPaymentId: event.payload!.id, webhookEventId: event.id,
        rawItn: rawBody, updatedAt: new Date(),
      }).where(and(eq(paymentsTable.id, payment.id), ne(paymentsTable.status, "complete")))
        .returning({ id: paymentsTable.id });
      if (!won.length) return { kind: "duplicate" as const };
      const balance = bookingBalance(appt.totalAmountCents, await readBookingPayments(tx, appt.id));
      if (balance.paidCents > appt.totalAmountCents) {
        logger.error({ bookingRef }, "[Yoco webhook] Excess money received; clinic reconciliation required");
      }
      if (balance.outstandingCents > 0) return { kind: "partial" as const, appt };

      if (["pending_payment", "payment_failed"].includes(appt.status)) {
        await tx.update(appointmentsTable).set({ status: "confirmed" }).where(eq(appointmentsTable.id, appt.id));
        return { kind: "confirmed" as const, appt };
      }
      if (["confirmed", "completed", "no-show"].includes(appt.status)) return { kind: "already" as const, appt };
      const [conflict] = await tx.select({ id: appointmentsTable.id }).from(appointmentsTable)
        .where(and(
          eq(appointmentsTable.date, appt.date), eq(appointmentsTable.time, appt.time),
          ne(appointmentsTable.status, "cancelled"), ne(appointmentsTable.id, appt.id),
        )).limit(1);
      if (!conflict) {
        await tx.update(appointmentsTable).set({ status: "confirmed" }).where(eq(appointmentsTable.id, appt.id));
        return { kind: "confirmed" as const, appt };
      }
      return { kind: "paid_but_slot_taken" as const, appt };
    });

    if (outcome.kind === "confirmed") {
      const [service] = await db.select({ name: servicesTable.name }).from(servicesTable)
        .where(eq(servicesTable.id, outcome.appt.serviceId)).limit(1);
      const details = {
        appointmentId: outcome.appt.id,
        bookingRef: outcome.appt.bookingRef,
        clientName: outcome.appt.clientName,
        clientWhatsapp: outcome.appt.clientWhatsapp,
        serviceName: service?.name ?? "",
        date: outcome.appt.date,
        time: outcome.appt.time,
      };
      void sendBookingConfirmation(details);
      if (outcome.appt.reminderScheduledFor) {
        scheduleReminderMessage(details, outcome.appt.reminderScheduledFor);
      }
    } else if (outcome.kind === "paid_but_slot_taken") {
      logger.error({ bookingRef }, "[Yoco webhook] PAID but expired slot was re-booked; refund/reschedule required");
    }
    res.status(200).send("OK");
  } catch (err) {
    logger.error({ err }, "[Yoco webhook] Processing failed");
    if (!res.headersSent) res.status(500).send("ERROR");
  }
});

export default router;