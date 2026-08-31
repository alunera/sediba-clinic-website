import { Router } from "express";
import { db } from "@workspace/db";
import { appointmentsTable, servicesTable, availabilitySlotsTable, paymentsTable } from "@workspace/db";
import { and, eq, gte, lte, ne, sql } from "drizzle-orm";
import {
  CreateAppointmentBody,
  GetAppointmentParams,
  UpdateAppointmentParams,
  UpdateAppointmentBody,
  DeleteAppointmentParams,
} from "@workspace/api-zod";
import {
  sendBookingConfirmation,
  scheduleReminderMessage,
  computeReminderTime,
} from "../lib/whatsapp";
import { clinicToday, isPastSlot, monthEnd } from "../lib/clinic-time";
import { requireAdmin } from "../middlewares/admin-auth";
import { releaseExpiredPendingBookings } from "./payments";

const router = Router();

function generateBookingRef(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let ref = "SWC-";
  for (let i = 0; i < 8; i++) {
    ref += chars[Math.floor(Math.random() * chars.length)];
  }
  return ref;
}

router.get("/appointments", async (req, res): Promise<void> => {
  const appointments = await db
    .select({
      id: appointmentsTable.id,
      bookingRef: appointmentsTable.bookingRef,
      clientName: appointmentsTable.clientName,
      clientEmail: appointmentsTable.clientEmail,
      clientPhone: appointmentsTable.clientPhone,
      clientWhatsapp: appointmentsTable.clientWhatsapp,
      serviceId: appointmentsTable.serviceId,
      serviceName: servicesTable.name,
      date: appointmentsTable.date,
      time: appointmentsTable.time,
      totalAmountCents: appointmentsTable.totalAmountCents,
      status: appointmentsTable.status,
      notes: appointmentsTable.notes,
      policyAgreed: appointmentsTable.policyAgreed,
      createdAt: appointmentsTable.createdAt,
    })
    .from(appointmentsTable)
    .leftJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
    .orderBy(appointmentsTable.date);

  res.json(appointments);
});

router.post("/appointments", async (req, res): Promise<void> => {
  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { serviceId, date, policyAgreed, ...rest } = parsed.data;

  const dateStr = date instanceof Date ? date.toISOString().split("T")[0] : String(date);

  // ── Availability validation (server-side source of truth) ──────────────
  if (isPastSlot(dateStr, rest.time)) {
    res.status(409).json({ error: "This time is in the past. Please choose another slot." });
    return;
  }

  const bookingRef = generateBookingRef();

  // Compute the reminder timestamp before the insert so it is persisted
  // atomically with the booking — no separate update needed afterwards.
  const reminderScheduledFor =
    rest.clientWhatsapp && rest.time
      ? computeReminderTime(dateStr, rest.time) ?? undefined
      : undefined;

  // Pull appointmentType out before spreading so the Zod-parsed type doesn't
  // conflict with the DB column type. It defaults to "treatment" if omitted.
  const { appointmentType, ...restInsert } = rest as typeof rest & { appointmentType?: string };

  // Validation + insert run in one transaction under a per-slot advisory
  // lock so an admin removing the slot (or another booking) cannot
  // interleave between the checks and the insert. The partial unique index
  // appointments_active_slot_uq is the final backstop.
  // Release any expired unpaid bookings first so their slots are re-bookable.
  await releaseExpiredPendingBookings();

  let appointment: typeof appointmentsTable.$inferSelect | undefined;
  let serviceName = "";
  let requiresPayment = false;
  let serviceNotFound = false;
  let conflictError: string | null = null;
  try {
    appointment = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`slot:${dateStr} ${rest.time}`}))`
      );

      const slotConfigured = await tx
        .select({ id: availabilitySlotsTable.id })
        .from(availabilitySlotsTable)
        .where(and(eq(availabilitySlotsTable.date, dateStr), eq(availabilitySlotsTable.time, rest.time)))
        .limit(1);
      if (!slotConfigured[0]) {
        conflictError = "This time slot is not available. Please choose another slot.";
        return undefined;
      }

      const conflict = await tx
        .select({ id: appointmentsTable.id })
        .from(appointmentsTable)
        .where(
          and(
            eq(appointmentsTable.date, dateStr),
            eq(appointmentsTable.time, rest.time),
            ne(appointmentsTable.status, "cancelled")
          )
        )
        .limit(1);
      if (conflict[0]) {
        conflictError = "This time slot has just been booked. Please choose another slot.";
        return undefined;
      }

      // Read the live service price in the same transaction as the insert.
      // CreateAppointmentBody deliberately has no amount field, so clients
      // cannot submit a stale or manipulated consultation price.
      const [service] = await tx
        .select({ name: servicesTable.name, price: servicesTable.price })
        .from(servicesTable)
        .where(eq(servicesTable.id, serviceId))
        .limit(1);
      if (!service) {
        serviceNotFound = true;
        return undefined;
      }

      serviceName = service.name;
      const totalAmountCents = service.price;
      // Treatments require 100% payment before confirmation. Consultations
      // keep the original immediate-confirmation flow.
      requiresPayment =
        (appointmentType ?? "treatment") === "treatment" && totalAmountCents > 0;
      const initialStatus = requiresPayment ? "pending_payment" : "confirmed";

      const [created] = await tx
        .insert(appointmentsTable)
        .values({
          ...restInsert,
          serviceId,
          date: dateStr,
          bookingRef,
          totalAmountCents,
          status: initialStatus,
          policyAgreed: policyAgreed ? "true" : "false",
          appointmentType: appointmentType ?? "treatment",
          reminderScheduledFor,
        })
        .returning();
      return created;
    });
  } catch (err: unknown) {
    // Unique index appointments_active_slot_uq: two clients raced for the
    // same slot — the second insert fails instead of double booking.
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "This time slot has just been booked. Please choose another slot." });
      return;
    }
    throw err;
  }

  if (serviceNotFound) {
    res.status(400).json({ error: "Service not found" });
    return;
  }

  if (!appointment) {
    res.status(409).json({ error: conflictError ?? "This time slot is not available. Please choose another slot." });
    return;
  }

  const apptDetails = {
    appointmentId: appointment.id,
    bookingRef: appointment.bookingRef,
    clientName: appointment.clientName,
    clientWhatsapp: appointment.clientWhatsapp,
    serviceName,
    date: appointment.date,
    time: appointment.time,
  };

  // Paid bookings only get their confirmation + reminder after the payment
  // is verified (see the Yoco webhook handler). Free/consultation bookings
  // are confirmed immediately as before.
  if (!requiresPayment) {
    // Send confirmation — failure is non-blocking
    void sendBookingConfirmation(apptDetails);

    // Enqueue the in-process timer (reminderScheduledFor is already in the DB)
    if (reminderScheduledFor) {
      scheduleReminderMessage(apptDetails, reminderScheduledFor);
    }
  }

  res.status(201).json({
    ...appointment,
    serviceName,
  });
});

router.get("/appointments/availability", async (req, res): Promise<void> => {
  // Note: generated GetAvailabilityQueryParams expects a Date object, but
  // query strings arrive as strings — validate the raw format instead.
  const dateStr = String(req.query.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    res.status(400).json({ error: "date must be YYYY-MM-DD" });
    return;
  }

  // Slots configured by the clinic admin for this date
  const configured = await db
    .select({ time: availabilitySlotsTable.time })
    .from(availabilitySlotsTable)
    .where(eq(availabilitySlotsTable.date, dateStr))
    .orderBy(availabilitySlotsTable.time);

  const existing = await db
    .select({ time: appointmentsTable.time })
    .from(appointmentsTable)
    .where(and(eq(appointmentsTable.date, dateStr), ne(appointmentsTable.status, "cancelled")));

  const bookedTimes = new Set(existing.map((a) => a.time));

  const slots = configured.map(({ time }) => ({
    time,
    available: !bookedTimes.has(time) && !isPastSlot(dateStr, time),
  }));

  res.json(slots);
});

router.get("/appointments/available-dates", async (req, res): Promise<void> => {
  const month = String(req.query.month ?? "");
  if (!/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ error: "month must be YYYY-MM" });
    return;
  }

  const today = clinicToday();
  const from = `${month}-01` < today ? today : `${month}-01`;

  const configured = await db
    .select({ date: availabilitySlotsTable.date, time: availabilitySlotsTable.time })
    .from(availabilitySlotsTable)
    .where(and(gte(availabilitySlotsTable.date, from), lte(availabilitySlotsTable.date, monthEnd(month))));

  if (configured.length === 0) {
    res.json({ dates: [] });
    return;
  }

  const booked = await db
    .select({ date: appointmentsTable.date, time: appointmentsTable.time })
    .from(appointmentsTable)
    .where(
      and(
        gte(appointmentsTable.date, from),
        lte(appointmentsTable.date, monthEnd(month)),
        ne(appointmentsTable.status, "cancelled")
      )
    );
  const bookedSet = new Set(booked.map((b) => `${b.date} ${b.time}`));

  const dates = [
    ...new Set(
      configured
        .filter((s) => !bookedSet.has(`${s.date} ${s.time}`) && !isPastSlot(s.date, s.time))
        .map((s) => s.date)
    ),
  ].sort();

  res.json({ dates });
});

router.get("/appointments/ref/:ref", async (req, res): Promise<void> => {
  const ref = req.params.ref as string;
  const rows = await db
    .select({
      id: appointmentsTable.id,
      bookingRef: appointmentsTable.bookingRef,
      clientName: appointmentsTable.clientName,
      clientEmail: appointmentsTable.clientEmail,
      clientPhone: appointmentsTable.clientPhone,
      clientWhatsapp: appointmentsTable.clientWhatsapp,
      serviceId: appointmentsTable.serviceId,
      serviceName: servicesTable.name,
      date: appointmentsTable.date,
      time: appointmentsTable.time,
      totalAmountCents: appointmentsTable.totalAmountCents,
      status: appointmentsTable.status,
      notes: appointmentsTable.notes,
      policyAgreed: appointmentsTable.policyAgreed,
      createdAt: appointmentsTable.createdAt,
    })
    .from(appointmentsTable)
    .leftJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
    .where(eq(appointmentsTable.bookingRef, ref));

  if (!rows[0]) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  res.json(rows[0]);
});

router.get("/appointments/:id", async (req, res): Promise<void> => {
  const parsed = GetAppointmentParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const rows = await db
    .select({
      id: appointmentsTable.id,
      bookingRef: appointmentsTable.bookingRef,
      clientName: appointmentsTable.clientName,
      clientEmail: appointmentsTable.clientEmail,
      clientPhone: appointmentsTable.clientPhone,
      clientWhatsapp: appointmentsTable.clientWhatsapp,
      serviceId: appointmentsTable.serviceId,
      serviceName: servicesTable.name,
      date: appointmentsTable.date,
      time: appointmentsTable.time,
      totalAmountCents: appointmentsTable.totalAmountCents,
      status: appointmentsTable.status,
      notes: appointmentsTable.notes,
      policyAgreed: appointmentsTable.policyAgreed,
      createdAt: appointmentsTable.createdAt,
    })
    .from(appointmentsTable)
    .leftJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
    .where(eq(appointmentsTable.id, parsed.data.id));

  if (!rows[0]) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  res.json(rows[0]);
});

router.patch("/appointments/:id", requireAdmin, async (req, res): Promise<void> => {
  const paramsParsed = UpdateAppointmentParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const bodyParsed = UpdateAppointmentBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  // Guard: a paid-treatment booking may only become "confirmed" through a
  // verified Yoco payment — the generic admin update cannot bypass it.
  if (bodyParsed.data.status === "confirmed") {
    const [current] = await db
      .select({
        status: appointmentsTable.status,
        appointmentType: appointmentsTable.appointmentType,
        totalAmountCents: appointmentsTable.totalAmountCents,
      })
      .from(appointmentsTable)
      .where(eq(appointmentsTable.id, paramsParsed.data.id))
      .limit(1);
    if (
      current &&
      (current.status === "pending_payment" || current.status === "payment_failed") &&
      current.appointmentType === "treatment" &&
      current.totalAmountCents > 0
    ) {
      const [paid] = await db
        .select({ id: paymentsTable.id })
        .from(paymentsTable)
        .where(and(eq(paymentsTable.appointmentId, paramsParsed.data.id), eq(paymentsTable.status, "complete")))
        .limit(1);
      if (!paid) {
        res.status(409).json({
          error:
            "This booking has not been paid. It can only be confirmed automatically once payment is verified.",
        });
        return;
      }
    }
  }

  const [updated] = await db
    .update(appointmentsTable)
    .set(bodyParsed.data)
    .where(eq(appointmentsTable.id, paramsParsed.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  const service = await db
    .select({ name: servicesTable.name })
    .from(servicesTable)
    .where(eq(servicesTable.id, updated.serviceId))
    .limit(1);

  res.json({ ...updated, serviceName: service[0]?.name ?? "" });
});

router.delete("/appointments/:id", requireAdmin, async (req, res): Promise<void> => {
  const parsed = DeleteAppointmentParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  await db
    .delete(appointmentsTable)
    .where(eq(appointmentsTable.id, parsed.data.id));

  res.status(204).send();
});

export default router;
