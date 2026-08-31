import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import { appointmentsTable, paymentsTable, servicesTable } from "@workspace/db";
import { and, eq, lt, ne, sql } from "drizzle-orm";
import { assertYocoReady, createYocoCheckout, verifyYocoWebhook } from "../lib/yoco";
import { sendBookingConfirmation, scheduleReminderMessage } from "../lib/whatsapp";
import { logger } from "../lib/logger";

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
        lt(appointmentsTable.createdAt, sql`now() - interval '${sql.raw(String(PENDING_PAYMENT_TTL_MIN))} minutes'`),
      )).returning({ id: appointmentsTable.id });
      return result.length;
    });
  }
  if (released) logger.info({ count: released }, "[Payments] Released expired bookings");
  return released;
}

router.post("/payments/initiate", async (req, res): Promise<void> => {
  try {
    assertYocoReady();
  } catch {
    res.status(503).json({ error: "Online payments are temporarily unavailable." });
    return;
  }
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
  if (!["pending_payment", "payment_failed"].includes(appt.status)) {
    res.status(409).json({ error: appt.status === "confirmed"
      ? "This booking is already paid and confirmed."
      : "This booking is no longer payable. Please start a new booking." });
    return;
  }
  if (appt.totalAmountCents <= 0) {
    res.status(409).json({ error: "This booking does not require payment." });
    return;
  }

  const [service] = await db.select({ name: servicesTable.name }).from(servicesTable)
    .where(eq(servicesTable.id, appt.serviceId)).limit(1);
  const attemptId = randomUUID();
  const checkout = await createYocoCheckout({
    checkoutId: attemptId,
    bookingRef,
    amountCents: appt.totalAmountCents,
    itemName: `Sediba — ${service?.name ?? "Treatment"} (${bookingRef})`,
  });
  await db.insert(paymentsTable).values({
    appointmentId: appt.id,
    bookingRef,
    // This is our idempotent attempt ID, also returned in Yoco metadata.
    checkoutId: attemptId,
    providerCheckoutId: checkout.id,
    amountCents: appt.totalAmountCents,
    provider: "yoco",
  });
  res.json({ url: checkout.redirectUrl, mode: checkout.mode });
});

router.get("/payments/status", async (req, res): Promise<void> => {
  const ref = String(req.query.ref ?? "");
  if (!/^SWC-[A-Z2-9]{8}$/.test(ref)) {
    res.status(400).json({ error: "Invalid booking reference" });
    return;
  }
  const [appt] = await db.select({
    bookingStatus: appointmentsTable.status,
    totalAmountCents: appointmentsTable.totalAmountCents,
  }).from(appointmentsTable).where(eq(appointmentsTable.bookingRef, ref)).limit(1);
  if (!appt) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  const attempts = await db.select({ status: paymentsTable.status }).from(paymentsTable)
    .where(eq(paymentsTable.bookingRef, ref)).orderBy(paymentsTable.id);
  res.json({
    bookingStatus: appt.bookingStatus,
    paymentStatus: attempts.at(-1)?.status ?? "none",
    amountCents: appt.totalAmountCents,
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
      .where(and(eq(paymentsTable.checkoutId, attemptId), eq(paymentsTable.bookingRef, bookingRef)))
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

      if (["pending_payment", "payment_failed"].includes(appt.status)) {
        await tx.update(appointmentsTable).set({ status: "confirmed" }).where(eq(appointmentsTable.id, appt.id));
        return { kind: "confirmed" as const, appt };
      }
      if (appt.status === "confirmed") return { kind: "already" as const, appt };
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