import { db } from "@workspace/db";
import { appointmentsTable, availabilitySlotsTable } from "@workspace/db";
import { and, eq, ne } from "drizzle-orm";
import { isPastSlot } from "./clinic-time";

export type AvailabilitySlot = { time: string; available: boolean };

export function combineAvailability(
  date: string,
  configured: readonly { time: string }[],
  existing: readonly { time: string }[],
  pastSlot: (date: string, time: string) => boolean = isPastSlot,
): AvailabilitySlot[] {
  const bookedTimes = new Set(existing.map((appointment) => appointment.time));
  return configured.map(({ time }) => ({
    time,
    available: !bookedTimes.has(time) && !pastSlot(date, time),
  }));
}

/**
 * The single live-availability implementation used by both the booking API and
 * Sedi. It reads the existing admin-configured slots and existing appointments;
 * it does not reserve or create anything.
 */
export async function getLiveAvailability(
  date: string,
): Promise<AvailabilitySlot[]> {
  const configured = await db
    .select({ time: availabilitySlotsTable.time })
    .from(availabilitySlotsTable)
    .where(eq(availabilitySlotsTable.date, date))
    .orderBy(availabilitySlotsTable.time);

  const existing = await db
    .select({ time: appointmentsTable.time })
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.date, date),
        ne(appointmentsTable.status, "cancelled"),
      ),
    );

  return combineAvailability(date, configured, existing);
}