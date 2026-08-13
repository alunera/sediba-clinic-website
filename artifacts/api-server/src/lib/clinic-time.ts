/**
 * Clinic timezone helpers. All availability and booking logic uses the
 * clinic's local time (Africa/Johannesburg, UTC+2, no DST).
 */

const CLINIC_TZ = "Africa/Johannesburg";

/** Current date in the clinic's timezone as "YYYY-MM-DD". */
export function clinicToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Current time of day in the clinic's timezone as "HH:MM" (24h). */
export function clinicNowTime(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CLINIC_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

/** Last day of a "YYYY-MM" month as "YYYY-MM-DD" (handles 28/29/30/31-day months). */
export function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(lastDay).padStart(2, "0")}`;
}

/** True if the given date ("YYYY-MM-DD") + time ("HH:MM") is in the past, clinic time. */
export function isPastSlot(date: string, time: string): boolean {
  const today = clinicToday();
  if (date < today) return true;
  if (date > today) return false;
  return time <= clinicNowTime();
}
