/**
 * WhatsApp notification service.
 *
 * Currently running as a STUB — messages are logged to the console instead of
 * being delivered. To go live, replace the `sendWhatsAppMessage` function body
 * with a real provider call (Twilio or WhatsApp Business Cloud API) and set the
 * required environment variables:
 *
 *  Twilio:
 *    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
 *
 *  WhatsApp Business Cloud API:
 *    WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
 */

import { logger } from "./logger";

export interface AppointmentDetails {
  bookingRef: string;
  clientName: string;
  clientWhatsapp: string | null | undefined;
  serviceName: string;
  date: string;   // "YYYY-MM-DD"
  time: string;   // "HH:MM"
}

/** Format a date string for display: "2026-08-12" → "12 August 2026" */
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Format a time string for display: "09:00" → "09:00 AM" */
function formatTime(time: string): string {
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
function buildReminderMessage(appt: AppointmentDetails): string {
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
 * Replace this body to wire in a real provider.
 */
async function sendWhatsAppMessage(to: string, body: string): Promise<void> {
  // --- STUB ---
  // In production, call Twilio or WhatsApp Business Cloud API here.
  // Example (Twilio):
  //   const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  //   await client.messages.create({
  //     from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
  //     to: `whatsapp:${to}`,
  //     body,
  //   });

  logger.info(
    { to, preview: body.slice(0, 80) },
    "[WhatsApp STUB] Would send message",
  );
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
    setTimeout(() => safeSetTimeout(callback, delayMs - MAX_SAFE_TIMEOUT_MS), MAX_SAFE_TIMEOUT_MS);
  }
}

/**
 * Schedule a reminder 24 hours before the appointment.
 * Uses a chained in-process timer that handles delays of any size correctly.
 * In production, replace with a persistent job queue (e.g. pg-boss, BullMQ)
 * so reminders survive server restarts — see follow-up task #5.
 */
export function scheduleReminderMessage(appt: AppointmentDetails): void {
  if (!appt.clientWhatsapp) {
    return;
  }

  // Parse appointment datetime in local server time
  const [year, month, day] = appt.date.split("-").map(Number);
  const [hour, minute] = appt.time.split(":").map(Number);
  const appointmentAt = new Date(year, month - 1, day, hour, minute, 0);
  const reminderAt = new Date(appointmentAt.getTime() - 24 * 60 * 60 * 1000);
  const now = Date.now();
  const delay = reminderAt.getTime() - now;

  if (delay <= 0) {
    logger.info(
      { bookingRef: appt.bookingRef },
      "[WhatsApp] Appointment is within 24 hours — skipping reminder",
    );
    return;
  }

  logger.info(
    {
      bookingRef: appt.bookingRef,
      reminderAt: reminderAt.toISOString(),
      delayMs: delay,
    },
    "[WhatsApp] Reminder scheduled",
  );

  safeSetTimeout(async () => {
    try {
      const message = buildReminderMessage(appt);
      await sendWhatsAppMessage(appt.clientWhatsapp as string, message);
      logger.info(
        { bookingRef: appt.bookingRef },
        "[WhatsApp] Reminder sent",
      );
    } catch (err) {
      logger.error(
        { err, bookingRef: appt.bookingRef },
        "[WhatsApp] Failed to send reminder",
      );
    }
  }, delay);
}
