/**
 * WhatsApp notification service.
 *
 * When all three Twilio environment variables are set the service delivers real
 * WhatsApp messages via the Twilio API.  When any of them is absent the service
 * falls back to stub mode: the message is logged as a warning and no HTTP call
 * is made to Twilio.
 *
 *  Required env vars for live mode:
 *    TWILIO_ACCOUNT_SID    – Twilio account SID
 *    TWILIO_AUTH_TOKEN     – Twilio auth token
 *    TWILIO_WHATSAPP_FROM  – sender number registered in Twilio (e.g. +14155238886)
 */

import twilio from "twilio";
import { db, appointmentsTable, servicesTable } from "@workspace/db";
import { isNull, isNotNull, and, eq } from "drizzle-orm";
import { logger } from "./logger";

export interface AppointmentDetails {
  appointmentId: number;
  bookingRef: string;
  clientName: string;
  clientWhatsapp: string | null | undefined;
  serviceName: string;
  date: string;   // "YYYY-MM-DD"
  time: string;   // "HH:MM"
}

/** Format a date string for display: "2026-08-12" → "12 August 2026" */
export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Format a time string for display: "09:00" → "09:00 AM" */
export function formatTime(time: string): string {
  const [hourStr, minStr] = time.split(":");
  const hour = parseInt(hourStr, 10);
  const min = minStr;
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(displayHour).padStart(2, "0")}:${min} ${period}`;
}

/** Build the confirmation message text. */
function buildConfirmationMessage(appt: AppointmentDetails): string {
  return [
    `Hi ${appt.clientName}! 👋`,
    ``,
    `Your booking at *Sediba Aesthetic & Wellness Clinic* is confirmed! ✅`,
    ``,
    `📋 *Booking Details*`,
    `• Treatment: ${appt.serviceName}`,
    `• Date: ${formatDate(appt.date)}`,
    `• Time: ${formatTime(appt.time)}`,
    `• Reference: *${appt.bookingRef}*`,
    ``,
    `📍 Please arrive 5–10 minutes before your appointment.`,
    ``,
    `⚠️ *Cancellation Policy*`,
    `Cancellations must be made at least 24 hours in advance. Late cancellations`,
    `or no-shows may be subject to a cancellation fee.`,
    ``,
    `To reschedule or cancel, please contact us directly.`,
    ``,
    `We look forward to seeing you! 💆`,
  ].join("\n");
}

/** Build the 24-hour reminder message text. */
export function buildReminderMessage(appt: AppointmentDetails): string {
  return [
    `Hi ${appt.clientName}! ⏰`,
    ``,
    `This is a reminder that you have an appointment *tomorrow* at`,
    `*Sediba Aesthetic & Wellness Clinic*.`,
    ``,
    `📋 *Appointment Details*`,
    `• Treatment: ${appt.serviceName}`,
    `• Date: ${formatDate(appt.date)}`,
    `• Time: ${formatTime(appt.time)}`,
    `• Reference: *${appt.bookingRef}*`,
    ``,
    `If you need to cancel or reschedule, please do so as soon as possible`,
    `to avoid a cancellation fee.`,
    ``,
    `See you tomorrow! 💆`,
  ].join("\n");
}

/**
 * Low-level send function.
 *
 * Uses Twilio when all three required env vars are present.
 * Falls back to a warning log (stub mode) when any credential is missing so
 * the server can run in development / CI without Twilio access.
 */
export async function sendWhatsAppMessage(to: string, body: string): Promise<void> {
  const sid  = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_WHATSAPP_FROM;

  if (!sid || !token || !from) {
    logger.warn(
      { to, preview: body.slice(0, 80) },
      "[WhatsApp STUB] Twilio credentials absent — message not sent",
    );
    return;
  }

  const client = twilio(sid, token);
  await client.messages.create({
    from: `whatsapp:${from}`,
    to:   `whatsapp:${to}`,
    body,
  });
}

/**
 * Send the booking confirmation WhatsApp message.
 * Failures are caught and logged — they never block the booking response.
 */
export async function sendBookingConfirmation(
  appt: AppointmentDetails,
): Promise<void> {
  const to = appt.clientWhatsapp ?? appt.clientName; // fallback for logging
  if (!appt.clientWhatsapp) {
    logger.info(
      { bookingRef: appt.bookingRef },
      "[WhatsApp] No WhatsApp number provided — skipping confirmation",
    );
    return;
  }

  try {
    const message = buildConfirmationMessage(appt);
    await sendWhatsAppMessage(appt.clientWhatsapp, message);
    logger.info(
      { bookingRef: appt.bookingRef, to },
      "[WhatsApp] Confirmation sent",
    );
  } catch (err) {
    logger.error(
      { err, bookingRef: appt.bookingRef },
      "[WhatsApp] Failed to send confirmation — booking still saved",
    );
  }
}

/**
 * Node.js setTimeout overflows (fires immediately) when the delay exceeds
 * 2,147,483,647 ms (~24.8 days) because the value is stored as a signed 32-bit
 * integer internally. This helper chains multiple timers so arbitrarily large
 * delays work correctly — important for appointments booked weeks or months out.
 */
const MAX_SAFE_TIMEOUT_MS = 2_000_000_000; // ~23 days, safely under the 32-bit cap

function safeSetTimeout(callback: () => void, delayMs: number): void {
  if (delayMs <= MAX_SAFE_TIMEOUT_MS) {
    setTimeout(callback, delayMs);
  } else {
    // Wait MAX_SAFE_TIMEOUT_MS, then recurse with the remaining delay
    setTimeout(
      () => safeSetTimeout(callback, delayMs - MAX_SAFE_TIMEOUT_MS),
      MAX_SAFE_TIMEOUT_MS,
    );
  }
}

/**
 * Fire the reminder for a given appointment: send the WhatsApp message and
 * stamp `reminderSentAt` in the database so the reminder is never re-sent.
 */
async function fireReminder(appt: AppointmentDetails): Promise<void> {
  try {
    const message = buildReminderMessage(appt);
    await sendWhatsAppMessage(appt.clientWhatsapp as string, message);
    logger.info({ bookingRef: appt.bookingRef }, "[WhatsApp] Reminder sent");
  } catch (err) {
    logger.error(
      { err, bookingRef: appt.bookingRef },
      "[WhatsApp] Failed to send reminder",
    );
  }

  // Always stamp sentAt so we don't retry on the next restart, even on failure.
  try {
    await db
      .update(appointmentsTable)
      .set({ reminderSentAt: new Date() })
      .where(eq(appointmentsTable.id, appt.appointmentId));
  } catch (dbErr) {
    logger.error(
      { dbErr, bookingRef: appt.bookingRef },
      "[WhatsApp] Failed to stamp reminderSentAt",
    );
  }
}

/**
 * Enqueue a reminder in memory. The reminder time must already be persisted in
 * the database before calling this — use `scheduleReminderMessage` for new
 * bookings, or `rehydrateReminders` on startup to re-queue existing ones.
 */
function enqueueReminder(appt: AppointmentDetails, reminderAt: Date): void {
  const delay = reminderAt.getTime() - Date.now();

  if (delay <= 0) {
    // Past-due: fire immediately (covers the case where the server was down
    // when the reminder was supposed to fire).
    logger.info(
      { bookingRef: appt.bookingRef },
      "[WhatsApp] Reminder is past-due — firing immediately",
    );
    void fireReminder(appt);
    return;
  }

  logger.info(
    {
      bookingRef: appt.bookingRef,
      reminderAt: reminderAt.toISOString(),
      delayMs: delay,
    },
    "[WhatsApp] Reminder queued",
  );

  safeSetTimeout(() => { void fireReminder(appt); }, delay);
}

/**
 * Compute the time at which the 24-hour reminder should fire for an
 * appointment described by `date` ("YYYY-MM-DD") and `time` ("HH:MM").
 *
 * Returns `null` if the reminder window has already passed (i.e. the
 * appointment is within 24 hours from now), so callers can skip scheduling.
 *
 * Exported so the appointment-creation route can persist the timestamp
 * atomically in the same DB insert, before calling `scheduleReminderMessage`.
 */
export function computeReminderTime(date: string, time: string): Date | null {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const appointmentAt = new Date(year, month - 1, day, hour, minute, 0);
  const reminderAt = new Date(appointmentAt.getTime() - 24 * 60 * 60 * 1000);
  return reminderAt.getTime() > Date.now() ? reminderAt : null;
}

/**
 * Enqueue the in-process reminder timer for a new booking.
 *
 * The caller is responsible for persisting `reminderScheduledFor` in the
 * database **before** calling this function (ideally in the same insert that
 * creates the appointment). This function only schedules the in-memory timer;
 * it performs no DB writes.
 *
 * Does nothing if `clientWhatsapp` is absent or if `reminderAt` is in the
 * past (which should not happen for new bookings but is safe to handle).
 */
export function scheduleReminderMessage(
  appt: AppointmentDetails,
  reminderAt: Date,
): void {
  if (!appt.clientWhatsapp) {
    return;
  }
  enqueueReminder(appt, reminderAt);
}

/**
 * Re-queue all pending reminders from the database.
 *
 * Call once on server startup. Finds every appointment whose reminder has been
 * scheduled but not yet sent, joins with the services table for the service
 * name, and enqueues each one. Past-due reminders are fired immediately.
 */
export async function rehydrateReminders(): Promise<void> {
  logger.info("[WhatsApp] Rehydrating pending reminders from database…");

  try {
    // Fetch appointments that have a scheduled reminder but haven't been sent yet
    const pending = await db
      .select({
        id: appointmentsTable.id,
        bookingRef: appointmentsTable.bookingRef,
        clientName: appointmentsTable.clientName,
        clientWhatsapp: appointmentsTable.clientWhatsapp,
        serviceName: servicesTable.name,
        date: appointmentsTable.date,
        time: appointmentsTable.time,
        reminderScheduledFor: appointmentsTable.reminderScheduledFor,
      })
      .from(appointmentsTable)
      .leftJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
      .where(
        and(
          isNotNull(appointmentsTable.reminderScheduledFor),
          isNull(appointmentsTable.reminderSentAt),
        ),
      );

    logger.info(
      { count: pending.length },
      "[WhatsApp] Pending reminders found",
    );

    for (const row of pending) {
      if (!row.clientWhatsapp || !row.reminderScheduledFor) continue;

      const appt: AppointmentDetails = {
        appointmentId: row.id,
        bookingRef: row.bookingRef,
        clientName: row.clientName,
        clientWhatsapp: row.clientWhatsapp,
        serviceName: row.serviceName ?? "your treatment",
        date: row.date,
        time: row.time,
      };

      const reminderAt = new Date(row.reminderScheduledFor);
      const [apptYear, apptMonth, apptDay] = row.date.split("-").map(Number);
      const [apptHour, apptMin] = row.time.split(":").map(Number);
      const appointmentAt = new Date(apptYear, apptMonth - 1, apptDay, apptHour, apptMin, 0);
      const now = new Date();

      if (reminderAt < now && appointmentAt < now) {
        // The reminder is past-due AND the appointment has already occurred.
        // Sending a belated reminder would confuse the client — skip it and
        // mark it as sent so it is never retried.
        logger.info(
          { bookingRef: row.bookingRef },
          "[WhatsApp] Appointment already passed — skipping reminder",
        );
        try {
          await db
            .update(appointmentsTable)
            .set({ reminderSentAt: now })
            .where(eq(appointmentsTable.id, row.id));
        } catch (dbErr) {
          logger.error(
            { dbErr, bookingRef: row.bookingRef },
            "[WhatsApp] Failed to stamp reminderSentAt for skipped reminder",
          );
        }
        continue;
      }

      enqueueReminder(appt, reminderAt);
    }
  } catch (err) {
    logger.error(
      { err },
      "[WhatsApp] Failed to rehydrate reminders — in-process reminders are unaffected",
    );
  }
}
