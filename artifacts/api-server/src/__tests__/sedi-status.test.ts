import { describe, expect, it, vi } from "vitest";
import {
  readAuthorizedBookingPaymentStatus,
  type SediStatusDependencies,
} from "../lib/sedi-status";

function dependencies(
  status: string,
  totalAmountCents: number,
  paymentStatus?: string,
): SediStatusDependencies {
  return {
    appointment: vi.fn().mockResolvedValue({
      id: 42,
      status,
      totalAmountCents,
    }),
    paymentAttempts: vi.fn().mockResolvedValue(
      paymentStatus
        ? [{ appointmentId: 42, id: 7, status: paymentStatus }]
        : [],
    ),
  };
}

describe("internal Sedi booking/payment status", () => {
  it("confirms a paid booking only from completed stored payment state", async () => {
    await expect(
      readAuthorizedBookingPaymentStatus(
        { appointmentId: 42, ownershipVerified: true },
        dependencies("confirmed", 95_000, "complete"),
      ),
    ).resolves.toEqual({
      appointmentId: 42,
      bookingStatus: "confirmed",
      paymentStatus: "paid",
      confirmed: true,
    });
  });

  it("does not falsely confirm pending, failed, or unverified paid claims", async () => {
    for (const [bookingStatus, paymentStatus] of [
      ["pending_payment", "created"],
      ["payment_failed", "failed"],
      ["confirmed", undefined],
    ] as const) {
      const result = await readAuthorizedBookingPaymentStatus(
        { appointmentId: 42, ownershipVerified: true },
        dependencies(bookingStatus, 95_000, paymentStatus),
      );
      expect(result?.confirmed).toBe(false);
    }
  });

  it("returns no PII and confirms an existing free confirmed booking", async () => {
    const result = await readAuthorizedBookingPaymentStatus(
      { appointmentId: 42, ownershipVerified: true },
      dependencies("confirmed", 0),
    );
    expect(result).toEqual({
      appointmentId: 42,
      bookingStatus: "confirmed",
      paymentStatus: "unpaid",
      confirmed: true,
    });
    expect(result).not.toHaveProperty("bookingRef");
    expect(result).not.toHaveProperty("clientEmail");
  });

  it("rejects a call that has not crossed the ownership-verified boundary", async () => {
    await expect(
      readAuthorizedBookingPaymentStatus(
        { appointmentId: 42, ownershipVerified: false } as never,
        dependencies("confirmed", 0),
      ),
    ).rejects.toThrow("Booking ownership must be verified");
  });
});