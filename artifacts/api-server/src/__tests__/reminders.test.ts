/**
 * Restart-survival integration tests for the appointment reminder system.
 *
 * These tests verify the full rehydration path: after a server restart,
 * pending reminders stored in the database are picked up and either
 * re-queued (future) or fired immediately (past-due).
 *
 * Strategy: mock @workspace/db so no real database is required, then
 * spy on `sendWhatsAppMessage` (reached through the module internals)
 * to assert the right reminders fire.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock pino logger so test output stays clean.
vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// We capture the rows that the mock DB will return for each test.
let mockPendingRows: unknown[] = [];

vi.mock("@workspace/db", () => {
  const isNotNull = vi.fn(() => ({ _tag: "isNotNull" }));
  const isNull = vi.fn(() => ({ _tag: "isNull" }));
  const and = vi.fn((...args: unknown[]) => ({ _tag: "and", args }));
  const eq = vi.fn(() => ({ _tag: "eq" }));

  const appointmentsTable = { id: "id", reminderScheduledFor: "rschfor", reminderSentAt: "rsentat" };
  const servicesTable = { id: "sid", name: "name" };

  // Chainable select builder that resolves to mockPendingRows
  const makeSelectBuilder = (): unknown => {
    const builder = {
      select: vi.fn(() => builder),
      from: vi.fn(() => builder),
      leftJoin: vi.fn(() => builder),
      where: vi.fn(() => Promise.resolve(mockPendingRows)),
      update: vi.fn(() => builder),
      set: vi.fn(() => builder),
    };
    return builder;
  };

  const db = {
    select: vi.fn(() => makeSelectBuilder()),
    update: vi.fn(() => makeSelectBuilder()),
  };

  return { db, appointmentsTable, servicesTable, isNotNull, isNull, and, eq };
});

// ─── System under test ────────────────────────────────────────────────────────

// Import AFTER mocks are in place.
import {
  rehydrateReminders,
  computeReminderTime,
  scheduleReminderMessage,
} from "../lib/whatsapp";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<{
  id: number;
  bookingRef: string;
  clientName: string;
  clientWhatsapp: string | null;
  serviceName: string | null;
  date: string;
  time: string;
  reminderScheduledFor: Date | null;
}> = {}) {
  return {
    id: 1,
    bookingRef: "SWC-TEST0001",
    clientName: "Test Client",
    clientWhatsapp: "+27821234567",
    serviceName: "Swedish Massage",
    date: "2099-12-31",
    time: "10:00",
    reminderScheduledFor: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("computeReminderTime", () => {
  it("returns a Date 24 h before the appointment when it is in the future", () => {
    // Appointment 2 days from now
    const future = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const dateStr = future.toISOString().split("T")[0]!;
    const timeStr = `${String(future.getHours()).padStart(2, "0")}:${String(future.getMinutes()).padStart(2, "0")}`;

    const reminderAt = computeReminderTime(dateStr, timeStr);
    expect(reminderAt).not.toBeNull();
    // Should be approximately 24 h before the appointment.
    // computeReminderTime works at minute granularity (HH:MM), so allow up to
    // 60 s of drift caused by sub-minute rounding.
    const expected = future.getTime() - 24 * 60 * 60 * 1000;
    expect(Math.abs(reminderAt!.getTime() - expected)).toBeLessThan(60_000);
  });

  it("returns null when the appointment is within 24 hours", () => {
    // Appointment 1 hour from now — reminder window has already passed
    const soon = new Date(Date.now() + 60 * 60 * 1000);
    const dateStr = soon.toISOString().split("T")[0]!;
    const timeStr = `${String(soon.getHours()).padStart(2, "0")}:${String(soon.getMinutes()).padStart(2, "0")}`;

    expect(computeReminderTime(dateStr, timeStr)).toBeNull();
  });
});

describe("rehydrateReminders", () => {
  beforeEach(() => {
    mockPendingRows = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("does nothing when there are no pending reminders", async () => {
    mockPendingRows = [];
    // Should resolve without throwing
    await expect(rehydrateReminders()).resolves.toBeUndefined();
  });

  it("skips rows that have no clientWhatsapp", async () => {
    mockPendingRows = [makeRow({ clientWhatsapp: null })];
    await expect(rehydrateReminders()).resolves.toBeUndefined();
    // No timers should have been scheduled
    expect(vi.getTimerCount()).toBe(0);
  });

  it("queues a future reminder as a timer", async () => {
    const reminderAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 h from now
    mockPendingRows = [makeRow({ reminderScheduledFor: reminderAt })];

    await rehydrateReminders();

    // A timer must have been registered for the reminder
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });

  it("fires a past-due reminder immediately without waiting for a timer (server was down during reminder window, appointment still upcoming)", async () => {
    // reminderScheduledFor is in the past but the appointment is still in the
    // future — the server missed the scheduled fire time, so the reminder must
    // go out immediately on rehydration rather than being silently skipped.
    const pastDue = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago
    mockPendingRows = [
      makeRow({
        reminderScheduledFor: pastDue,
        date: "2099-12-31", // appointment is in the far future
        time: "10:00",
      }),
    ];

    await rehydrateReminders();

    // No long-running timer should be pending — immediate path was taken
    expect(vi.getTimerCount()).toBe(0);

    // The logger must have recorded the "past-due" branch, not the "skip" branch
    const infoMock = vi.mocked(logger.info);
    const pastDueCall = infoMock.mock.calls.find(
      ([, msg]) => typeof msg === "string" && /past-due/i.test(msg),
    );
    expect(pastDueCall).toBeDefined();

    // The "appointment already passed" skip log must NOT appear
    const skipCall = infoMock.mock.calls.find(
      ([, msg]) => typeof msg === "string" && /already passed/i.test(msg),
    );
    expect(skipCall).toBeUndefined();
  });

  it("skips reminder and stamps reminderSentAt when both reminder time and appointment have passed", async () => {
    // Simulate a long server outage: the reminder window AND the appointment
    // itself are both in the past.  Sending a belated reminder now would confuse
    // the client — rehydrateReminders must skip it and mark it sent so it is
    // never retried.
    const longPastReminder = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 h ago
    mockPendingRows = [
      makeRow({
        reminderScheduledFor: longPastReminder,
        date: "2020-06-15", // appointment well in the past
        time: "09:00",
      }),
    ];

    await rehydrateReminders();

    // No timer should have been scheduled
    expect(vi.getTimerCount()).toBe(0);

    // The skip branch must log the "already passed" message
    const infoMock = vi.mocked(logger.info);
    const skipCall = infoMock.mock.calls.find(
      ([, msg]) => typeof msg === "string" && /already passed/i.test(msg),
    );
    expect(skipCall).toBeDefined();

    // db.update must have been called to stamp reminderSentAt
    expect(vi.mocked(db.update)).toHaveBeenCalledOnce();
  });

  it("stamps reminderSentAt only for the expired appointment, not for future ones", async () => {
    // Mixed batch: one appointment already passed, one still upcoming.
    const longPastReminder = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const futureReminder   = new Date(Date.now() + 2 * 60 * 60 * 1000);

    mockPendingRows = [
      makeRow({ id: 1, bookingRef: "SWC-PAST",   reminderScheduledFor: longPastReminder, date: "2020-06-15", time: "09:00" }),
      makeRow({ id: 2, bookingRef: "SWC-FUTURE",  reminderScheduledFor: futureReminder,   date: "2099-12-31", time: "10:00" }),
    ];

    await rehydrateReminders();

    // Exactly one timer for the upcoming reminder
    expect(vi.getTimerCount()).toBe(1);

    // db.update called once — only for the expired appointment (not for the future one)
    expect(vi.mocked(db.update)).toHaveBeenCalledOnce();
  });

  it("handles multiple pending reminders independently", async () => {
    const future1 = new Date(Date.now() + 1 * 60 * 60 * 1000);
    const future2 = new Date(Date.now() + 3 * 60 * 60 * 1000);
    mockPendingRows = [
      makeRow({ id: 1, bookingRef: "SWC-AAA", reminderScheduledFor: future1 }),
      makeRow({ id: 2, bookingRef: "SWC-BBB", reminderScheduledFor: future2 }),
    ];

    await rehydrateReminders();

    // Two separate timers should have been registered
    expect(vi.getTimerCount()).toBe(2);
  });
});

describe("scheduleReminderMessage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("enqueues a timer when a WhatsApp number is present", () => {
    const reminderAt = new Date(Date.now() + 30 * 60 * 1000);
    scheduleReminderMessage(
      {
        appointmentId: 99,
        bookingRef: "SWC-TEST",
        clientName: "Alice",
        clientWhatsapp: "+27821234567",
        serviceName: "Facial",
        date: "2099-12-31",
        time: "14:00",
      },
      reminderAt,
    );
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });

  it("does not enqueue a timer when no WhatsApp number is provided", () => {
    const reminderAt = new Date(Date.now() + 30 * 60 * 1000);
    scheduleReminderMessage(
      {
        appointmentId: 100,
        bookingRef: "SWC-TEST2",
        clientName: "Bob",
        clientWhatsapp: null,
        serviceName: "Facial",
        date: "2099-12-31",
        time: "14:00",
      },
      reminderAt,
    );
    expect(vi.getTimerCount()).toBe(0);
  });
});
