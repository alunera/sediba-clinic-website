import { Router } from "express";
import { db, availabilitySlotsTable, appointmentsTable } from "@workspace/db";
import { and, eq, gte, lte, ne, inArray } from "drizzle-orm";
import { AdminAddAvailabilitySlotsBody } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/admin-auth";

const router = Router();

const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Booked = a non-cancelled appointment occupies the date+time. */
async function bookedTimesForDates(dates: string[]): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  if (dates.length === 0) return map;
  const rows = await db
    .select({ date: appointmentsTable.date, time: appointmentsTable.time })
    .from(appointmentsTable)
    .where(and(inArray(appointmentsTable.date, dates), ne(appointmentsTable.status, "cancelled")));
  for (const r of rows) {
    if (!map.has(r.date)) map.set(r.date, new Set());
    map.get(r.date)!.add(r.time);
  }
  return map;
}

router.get("/admin/availability", requireAdmin, async (req, res): Promise<void> => {
  const month = String(req.query.month ?? "");
  if (!MONTH_RE.test(month)) {
    res.status(400).json({ error: "month must be YYYY-MM" });
    return;
  }

  const slots = await db
    .select()
    .from(availabilitySlotsTable)
    .where(and(gte(availabilitySlotsTable.date, `${month}-01`), lte(availabilitySlotsTable.date, `${month}-31`)))
    .orderBy(availabilitySlotsTable.date, availabilitySlotsTable.time);

  const dates = [...new Set(slots.map((s) => s.date))];
  const booked = await bookedTimesForDates(dates);

  const days = dates.map((date) => ({
    date,
    slots: slots
      .filter((s) => s.date === date)
      .map((s) => ({ time: s.time, booked: booked.get(date)?.has(s.time) ?? false })),
  }));

  res.json(days);
});

router.post("/admin/availability/slots", requireAdmin, async (req, res): Promise<void> => {
  const parsed = AdminAddAvailabilitySlotsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const date =
    parsed.data.date instanceof Date
      ? parsed.data.date.toISOString().split("T")[0]
      : String(parsed.data.date);
  const times = [...new Set(parsed.data.times)];
  if (!DATE_RE.test(date) || times.some((t) => !TIME_RE.test(t))) {
    res.status(400).json({ error: "Invalid date or time format" });
    return;
  }

  await db
    .insert(availabilitySlotsTable)
    .values(times.map((time) => ({ date, time })))
    .onConflictDoNothing();

  const slots = await db
    .select()
    .from(availabilitySlotsTable)
    .where(eq(availabilitySlotsTable.date, date))
    .orderBy(availabilitySlotsTable.time);
  const booked = await bookedTimesForDates([date]);

  res.json({
    date,
    slots: slots.map((s) => ({ time: s.time, booked: booked.get(date)?.has(s.time) ?? false })),
  });
});

router.delete("/admin/availability/slots", requireAdmin, async (req, res): Promise<void> => {
  const date = String(req.query.date ?? "");
  const time = String(req.query.time ?? "");
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) {
    res.status(400).json({ error: "Invalid date or time" });
    return;
  }

  const booked = await bookedTimesForDates([date]);
  if (booked.get(date)?.has(time)) {
    res.status(409).json({
      error: "This slot has a booked appointment. Cancel the appointment first.",
    });
    return;
  }

  await db
    .delete(availabilitySlotsTable)
    .where(and(eq(availabilitySlotsTable.date, date), eq(availabilitySlotsTable.time, time)));

  res.status(204).send();
});

router.delete("/admin/availability/dates/:date", requireAdmin, async (req, res): Promise<void> => {
  const date = String(req.params.date ?? "");
  if (!DATE_RE.test(date)) {
    res.status(400).json({ error: "Invalid date" });
    return;
  }

  const booked = await bookedTimesForDates([date]);
  const bookedSet = booked.get(date) ?? new Set<string>();

  const existing = await db
    .select()
    .from(availabilitySlotsTable)
    .where(eq(availabilitySlotsTable.date, date));

  const removable = existing.filter((s) => !bookedSet.has(s.time)).map((s) => s.time);
  if (removable.length > 0) {
    await db
      .delete(availabilitySlotsTable)
      .where(and(eq(availabilitySlotsTable.date, date), inArray(availabilitySlotsTable.time, removable)));
  }

  res.json({ removed: removable.length, bookedRemaining: existing.length - removable.length });
});

export default router;
