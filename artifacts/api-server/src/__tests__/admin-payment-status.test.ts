import { describe, expect, it } from "vitest";
import {
  deriveAdminPaymentStatus,
  groupPaymentAttempts,
} from "../lib/admin-payment-status";

describe("admin payment status", () => {
  it("shows Paid when any correctly linked attempt completed", () => {
    expect(
      deriveAdminPaymentStatus(
        [
          { appointmentId: 1, id: 10, status: "complete" },
          { appointmentId: 1, id: 11, status: "created" },
        ],
        "confirmed",
      ),
    ).toBe("paid");
  });

  it("shows Pending for a payable booking with no completed attempt", () => {
    expect(deriveAdminPaymentStatus([], "pending_payment")).toBe("pending");
    expect(
      deriveAdminPaymentStatus(
        [{ appointmentId: 1, id: 10, status: "created" }],
        "pending_payment",
      ),
    ).toBe("pending");
  });

  it("shows Failed when the newest non-completed attempt failed", () => {
    expect(
      deriveAdminPaymentStatus(
        [
          { appointmentId: 1, id: 10, status: "created" },
          { appointmentId: 1, id: 11, status: "failed" },
        ],
        "payment_failed",
      ),
    ).toBe("failed");
  });

  it("shows Unpaid for a legacy confirmed booking with no payment attempt", () => {
    expect(deriveAdminPaymentStatus([], "confirmed")).toBe("unpaid");
  });

  it("shows Failed for a failed booking even if checkout creation did not record an attempt", () => {
    expect(deriveAdminPaymentStatus([], "payment_failed")).toBe("failed");
  });

  it("keeps attempts isolated to their associated booking", () => {
    const grouped = groupPaymentAttempts([
      { appointmentId: 1, id: 10, status: "complete" },
      { appointmentId: 2, id: 11, status: "failed" },
    ]);

    expect(deriveAdminPaymentStatus(grouped.get(1) ?? [], "confirmed")).toBe("paid");
    expect(deriveAdminPaymentStatus(grouped.get(2) ?? [], "payment_failed")).toBe("failed");
    expect(deriveAdminPaymentStatus(grouped.get(3) ?? [], "pending_payment")).toBe("pending");
  });
});