import { describe, expect, it } from "vitest";
import { bookingBalance, receiptBlockedReason } from "../lib/booking-receipts";
import { deriveAdminPaymentStatus } from "../lib/admin-payment-status";

describe("appointment receipts", () => {
  const partial = { provider: "in_salon", status: "complete", amountCents: 10000 };
  it("sums receipts, ignores unsuccessful attempts and preserves the remaining balance", () => {
    expect(bookingBalance(25000, [partial, { provider: "yoco", status: "failed", amountCents: 25000 }]))
      .toEqual({ paidCents: 10000, outstandingCents: 15000, inSalon: true });
    expect(bookingBalance(25000, [partial, { ...partial, amountCents: 15000 }]).outstandingCents).toBe(0);
  });
  it("distinguishes part-paid from fully paid in admin", () => {
    const attempts = [{ ...partial, id: 1, appointmentId: 1 }];
    expect(deriveAdminPaymentStatus(attempts, "pending_payment", 25000)).toBe("part_paid");
    expect(deriveAdminPaymentStatus(attempts, "confirmed", 10000)).toBe("paid");
  });
  it("blocks settled, cancelled and unresolved hosted checkouts", () => {
    expect(receiptBlockedReason("cancelled", 25000, [])).toMatch(/cancelled/);
    expect(receiptBlockedReason("confirmed", 10000, [partial])).toMatch(/no outstanding/);
    for (const status of ["creating", "created", "failed", "cancelled"]) {
      expect(receiptBlockedReason("pending_payment", 25000, [{ provider: "yoco", status, amountCents: 25000 }])).toMatch(/checkout/);
    }
    expect(receiptBlockedReason("pending_payment", 25000, [partial])).toBe("");
  });
});
