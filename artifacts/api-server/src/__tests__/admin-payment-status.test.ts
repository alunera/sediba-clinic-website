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
        "treatment",
        120000,
      ),
    ).toBe("paid");
  });

  it("shows Pending for a payable booking with no completed attempt", () => {
    expect(deriveAdminPaymentStatus([], "treatment", 120000)).toBe("pending");
    expect(
      deriveAdminPaymentStatus(
        [{ appointmentId: 1, id: 10, status: "created" }],
        "treatment",
        120000,
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
        "treatment",
        120000,
      ),
    ).toBe("failed");
  });

  it("shows Unpaid for a booking that does not use the payment flow", () => {
    expect(deriveAdminPaymentStatus([], "consultation", 35000)).toBe("unpaid");
  });

  it("keeps attempts isolated to their associated booking", () => {
    const grouped = groupPaymentAttempts([
      { appointmentId: 1, id: 10, status: "complete" },
      { appointmentId: 2, id: 11, status: "failed" },
    ]);

    expect(deriveAdminPaymentStatus(grouped.get(1) ?? [], "treatment", 50000)).toBe("paid");
    expect(deriveAdminPaymentStatus(grouped.get(2) ?? [], "treatment", 50000)).toBe("failed");
    expect(deriveAdminPaymentStatus(grouped.get(3) ?? [], "treatment", 50000)).toBe("pending");
  });
});