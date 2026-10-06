import { describe, expect, it } from "vitest";
import { refundInput, refundBalance, refundError } from "../lib/appointment-refunds";
import { bookingBalance } from "../lib/booking-receipts";

const base = { requestId: "test-refund-request-001", paymentId: 1, amountCents: 1000,
  method: "cash", reference: "Cash returned", reason: "Client cancellation", returned: true };
describe("appointment refund boundaries", () => {
  it("validates evidence and integer money before entering a transaction", () => {
    expect(refundInput.safeParse(base).success).toBe(true);
    for (const patch of [{ paymentId: 1.2 }, { paymentId: 0 }, { amountCents: 1.2 },
      { amountCents: -1 }, { amountCents: 0 }, { amountCents: 100000001 }, { reason: " " },
      { reference: " " }, { returned: false }, { method: "bitcoin" }]) {
      expect(refundInput.safeParse({ ...base, ...patch }).success).toBe(false);
    }
  });
  it("caps refunds per payment and rejects fake Yoco method on salon receipts", () => {
    const payment = { status: "complete", provider: "in_salon", amountCents: 2500 };
    expect(refundError(payment, 500, { amountCents: 2000, method: "cash" })).toBe(null);
    expect(refundError(payment, 500, { amountCents: 2001, method: "cash" })).toMatch(/exceeds/);
    expect(refundError(payment, 0, { amountCents: 500, method: "yoco" })).toMatch(/Yoco/);
    expect(refundError({ ...payment,status: "failed" }, 0, base)).toMatch(/completed/);
  });
  it("reduces net retained money without reopening paid debt or cancelling appointments", () => {
    const attempts = [{ provider: "in_salon", status: "complete", amountCents: 2500 }];
    expect(refundBalance(2500, [{ amountCents: 1000 },{ amountCents: 1500 }]))
      .toEqual({ refundedCents: 2500,netReceiptsCents: 0 });
    expect(bookingBalance(2500, attempts).outstandingCents).toBe(0);
    expect(bookingBalance(4000, attempts).outstandingCents).toBe(1500);
  });
});
