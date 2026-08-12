/**
 * Tests for the WhatsApp booking-confirmation path.
 *
 * Three scenarios are covered:
 *  1. Happy path — Twilio credentials present → `messages.create` called with
 *     the correct `from`, `to`, and non-empty `body`.
 *  2. Stub mode — any credential absent → no Twilio call, a warning is logged.
 *  3. No WhatsApp number — `clientWhatsapp` absent → confirmation silently
 *     skipped (no Twilio call, no warning).
 *
 * Strategy: mock the `twilio` module so no real HTTP calls are made, then spy
 * on `logger.warn` / `logger.info` to verify log output.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Hoisted spies ────────────────────────────────────────────────────────────
// vi.mock factories are hoisted above all imports, so any variables they close
// over must also be hoisted via vi.hoisted.

const { mockMessagesCreate, mockTwilio } = vi.hoisted(() => {
  const mockMessagesCreate = vi.fn().mockResolvedValue({ sid: "SM_TEST" });
  const mockClient = { messages: { create: mockMessagesCreate } };
  const mockTwilio = vi.fn(() => mockClient);
  return { mockMessagesCreate, mockTwilio };
});

// ─── Mock: twilio ─────────────────────────────────────────────────────────────

vi.mock("twilio", () => ({ default: mockTwilio }));

// ─── Mock: pino logger ────────────────────────────────────────────────────────

vi.mock("../lib/logger", () => ({
  logger: {
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
  },
}));

// ─── Mock: @workspace/db (not used by sendBookingConfirmation, but imported) ──

vi.mock("@workspace/db", () => {
  const appointmentsTable = { id: "id", reminderScheduledFor: "rschfor", reminderSentAt: "rsentat" };
  const servicesTable     = { id: "sid", name: "name" };
  const db = {
    select: vi.fn(),
    update: vi.fn(),
  };
  const isNotNull = vi.fn();
  const isNull    = vi.fn();
  const and       = vi.fn();
  const eq        = vi.fn();
  return { db, appointmentsTable, servicesTable, isNotNull, isNull, and, eq };
});

// ─── System under test ────────────────────────────────────────────────────────

import { sendBookingConfirmation, sendWhatsAppMessage } from "../lib/whatsapp";
import { logger } from "../lib/logger";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BASE_APPT = {
  appointmentId: 1,
  bookingRef:    "SWC-TEST0001",
  clientName:    "Amahle Dlamini",
  clientWhatsapp: "+27821234567",
  serviceName:   "Swedish Massage",
  date:          "2099-12-31",
  time:          "10:00",
} as const;

/** Restore env vars after each test. */
const savedEnv: Record<string, string | undefined> = {};
function setEnv(vars: Record<string, string | undefined>): void {
  for (const [k, v] of Object.entries(vars)) {
    savedEnv[k] = process.env[k];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
}
function restoreEnv(): void {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("sendWhatsAppMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    restoreEnv();
  });

  describe("when Twilio credentials are present", () => {
    beforeEach(() => {
      setEnv({
        TWILIO_ACCOUNT_SID:   "ACtest123",
        TWILIO_AUTH_TOKEN:    "token_abc",
        TWILIO_WHATSAPP_FROM: "+14155238886",
      });
    });

    it("calls messages.create with whatsapp: prefix on from and to", async () => {
      await sendWhatsAppMessage("+27821234567", "Hello!");

      expect(mockMessagesCreate).toHaveBeenCalledOnce();
      expect(mockMessagesCreate).toHaveBeenCalledWith({
        from: "whatsapp:+14155238886",
        to:   "whatsapp:+27821234567",
        body: "Hello!",
      });
    });

    it("passes the full message body to messages.create", async () => {
      const body = "Hi there!\n\nYour booking is confirmed. ✅";
      await sendWhatsAppMessage("+27821234567", body);

      const call = mockMessagesCreate.mock.calls[0]![0] as { body: string };
      expect(call.body).toBe(body);
    });

    it("does NOT log a stub warning", async () => {
      await sendWhatsAppMessage("+27821234567", "Test");
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe("when Twilio credentials are absent (stub mode)", () => {
    beforeEach(() => {
      setEnv({
        TWILIO_ACCOUNT_SID:   undefined,
        TWILIO_AUTH_TOKEN:    undefined,
        TWILIO_WHATSAPP_FROM: undefined,
      });
    });

    it("does NOT call messages.create", async () => {
      await sendWhatsAppMessage("+27821234567", "Hello!");
      expect(mockMessagesCreate).not.toHaveBeenCalled();
    });

    it("logs a warning so the absence is visible in logs", async () => {
      await sendWhatsAppMessage("+27821234567", "Hello!");
      expect(logger.warn).toHaveBeenCalledOnce();
      const [, msg] = (logger.warn as ReturnType<typeof vi.fn>).mock.calls[0] as [unknown, string];
      expect(msg).toMatch(/stub/i);
    });

    it("returns without throwing", async () => {
      await expect(sendWhatsAppMessage("+27821234567", "Hello!")).resolves.toBeUndefined();
    });
  });

  describe("when only some Twilio credentials are set", () => {
    it("treats partial credentials as absent — no Twilio call, warning logged", async () => {
      setEnv({
        TWILIO_ACCOUNT_SID:   "ACtest123",
        TWILIO_AUTH_TOKEN:    undefined,          // missing
        TWILIO_WHATSAPP_FROM: "+14155238886",
      });

      await sendWhatsAppMessage("+27821234567", "Hello!");

      expect(mockMessagesCreate).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledOnce();
    });
  });
});

describe("sendBookingConfirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    restoreEnv();
  });

  describe("when a WhatsApp number is provided and credentials are present", () => {
    beforeEach(() => {
      setEnv({
        TWILIO_ACCOUNT_SID:   "ACtest123",
        TWILIO_AUTH_TOKEN:    "token_abc",
        TWILIO_WHATSAPP_FROM: "+14155238886",
      });
    });

    it("calls messages.create with the client's number", async () => {
      await sendBookingConfirmation(BASE_APPT);

      expect(mockMessagesCreate).toHaveBeenCalledOnce();
      const args = mockMessagesCreate.mock.calls[0]![0] as {
        from: string;
        to:   string;
        body: string;
      };
      expect(args.from).toBe("whatsapp:+14155238886");
      expect(args.to).toBe("whatsapp:+27821234567");
    });

    it("sends a body that contains the client name", async () => {
      await sendBookingConfirmation(BASE_APPT);

      const { body } = mockMessagesCreate.mock.calls[0]![0] as { body: string };
      expect(body).toContain("Amahle Dlamini");
    });

    it("sends a body that contains the booking reference", async () => {
      await sendBookingConfirmation(BASE_APPT);

      const { body } = mockMessagesCreate.mock.calls[0]![0] as { body: string };
      expect(body).toContain("SWC-TEST0001");
    });

    it("sends a body that contains the service name", async () => {
      await sendBookingConfirmation(BASE_APPT);

      const { body } = mockMessagesCreate.mock.calls[0]![0] as { body: string };
      expect(body).toContain("Swedish Massage");
    });

    it("does not throw even when messages.create rejects", async () => {
      mockMessagesCreate.mockRejectedValueOnce(new Error("Twilio 500"));
      await expect(sendBookingConfirmation(BASE_APPT)).resolves.toBeUndefined();
    });
  });

  describe("when credentials are absent (stub mode)", () => {
    beforeEach(() => {
      setEnv({
        TWILIO_ACCOUNT_SID:   undefined,
        TWILIO_AUTH_TOKEN:    undefined,
        TWILIO_WHATSAPP_FROM: undefined,
      });
    });

    it("does NOT call messages.create", async () => {
      await sendBookingConfirmation(BASE_APPT);
      expect(mockMessagesCreate).not.toHaveBeenCalled();
    });

    it("logs a stub warning (credentials absent path)", async () => {
      await sendBookingConfirmation(BASE_APPT);
      expect(logger.warn).toHaveBeenCalledOnce();
    });
  });

  describe("when clientWhatsapp is absent", () => {
    beforeEach(() => {
      setEnv({
        TWILIO_ACCOUNT_SID:   "ACtest123",
        TWILIO_AUTH_TOKEN:    "token_abc",
        TWILIO_WHATSAPP_FROM: "+14155238886",
      });
    });

    it("does NOT call messages.create", async () => {
      await sendBookingConfirmation({ ...BASE_APPT, clientWhatsapp: null });
      expect(mockMessagesCreate).not.toHaveBeenCalled();
    });

    it("does not throw", async () => {
      await expect(
        sendBookingConfirmation({ ...BASE_APPT, clientWhatsapp: null }),
      ).resolves.toBeUndefined();
    });

    it("logs an info message noting no WhatsApp number was provided", async () => {
      await sendBookingConfirmation({ ...BASE_APPT, clientWhatsapp: null });
      const warnCalls = (logger.warn as ReturnType<typeof vi.fn>).mock.calls;
      // Should not have logged the STUB warning (no credentials branch)
      expect(warnCalls.length).toBe(0);
      // Should have logged an info skip message
      const infoCalls = (logger.info as ReturnType<typeof vi.fn>).mock.calls;
      const skipMsg = infoCalls.find(([, msg]: [unknown, string]) =>
        typeof msg === "string" && /skipping/i.test(msg),
      );
      expect(skipMsg).toBeDefined();
    });

    it("behaves the same when clientWhatsapp is undefined", async () => {
      await sendBookingConfirmation({ ...BASE_APPT, clientWhatsapp: undefined });
      expect(mockMessagesCreate).not.toHaveBeenCalled();
    });
  });
});
