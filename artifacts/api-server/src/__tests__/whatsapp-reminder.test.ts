import { describe, expect, it } from "vitest";
import {
  buildReminderMessage,
  formatDate,
  formatTime,
  type AppointmentDetails,
} from "../lib/whatsapp";

const APPOINTMENT: AppointmentDetails = {
  appointmentId: 1,
  bookingRef: "SWC-TEST0001",
  clientName: "Amahle Dlamini",
  clientWhatsapp: "+27821234567",
  serviceName: "Swedish Massage",
  date: "2026-08-12",
  time: "09:00",
};

describe("buildReminderMessage", () => {
  const message = buildReminderMessage(APPOINTMENT);

  it("contains the client name", () => {
    expect(message).toContain("Amahle Dlamini");
  });

  it("contains the booking reference", () => {
    expect(message).toContain("SWC-TEST0001");
  });

  it("contains the service name", () => {
    expect(message).toContain("Swedish Massage");
  });

  it("contains the correctly formatted date", () => {
    expect(message).toContain("12 August 2026");
  });

  it("contains the correctly formatted time", () => {
    expect(message).toContain("09:00 AM");
  });
});

describe("reminder date and time formatting", () => {
  it("formats an ISO clinic date without a timezone shift", () => {
    expect(formatDate("2026-08-12")).toBe("12 August 2026");
  });

  it("formats morning, afternoon, and midnight times", () => {
    expect(formatTime("09:00")).toBe("09:00 AM");
    expect(formatTime("15:30")).toBe("03:30 PM");
    expect(formatTime("00:00")).toBe("12:00 AM");
  });
});