import { describe, expect, it } from "vitest";
import { entryError, saleBalance, saleTotal, validReportDates, saleInput as CreateAdminSaleBody, saleEntryInput as AddAdminSaleEntryBody } from "../lib/sales";

describe("sales money rules", () => {
  it("uses integer cents and rejects excessive totals", () => {
    expect(saleTotal([{ description: "Treatment", kind: "treatment", quantity: 3, unitPriceCents: 12345 }])).toBe(37035);
    expect(() => saleTotal([{ description: "Too much", kind: "product", quantity: 1000, unitPriceCents: 100000000 }])).toThrow();
  });
  it("requires valid positive monetary amounts and integer quantities at the API boundary", () => {
    const base = { requestId: "test-request-id-0001", clientId: 1, items: [{ description: "Product", kind: "product", quantity: 1, unitPriceCents: 100 }] };
    expect(CreateAdminSaleBody.safeParse(base).success).toBe(true);
    for (const price of [0, -1, 1.5, 100000001]) {
      expect(CreateAdminSaleBody.safeParse({ ...base, items: [{ ...base.items[0], unitPriceCents: price }] }).success).toBe(false);
    }
    expect(CreateAdminSaleBody.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(CreateAdminSaleBody.safeParse({ ...base, items: [{ ...base.items[0], quantity: 1.5 }] }).success).toBe(false);
    expect(AddAdminSaleEntryBody.safeParse({ requestId: base.requestId, kind: "payment", amountCents: 1.5, method: "cash", reason: "Received" }).success).toBe(false);
  });
  it("unpaid and partly-paid sales do not count as fully paid", () => {
    expect(saleBalance(10000, [], false)).toMatchObject({ status: "unpaid", outstandingCents: 10000, paidCents: 0 });
    expect(saleBalance(10000, [{ kind: "payment", amountCents: 2500 }], false)).toMatchObject({ status: "part_paid", outstandingCents: 7500 });
  });
  it("rejects overpayment and refunds beyond actual receipts", () => {
    const entries = [{ kind: "payment", amountCents: 2500 }];
    expect(entryError(10000, entries, false, { kind: "payment", amountCents: 7501 })).toMatch(/exceeds/);
    expect(entryError(10000, entries, false, { kind: "payment", amountCents: 7500 })).toBeNull();
    expect(entryError(10000, entries, false, { kind: "refund", amountCents: 2501 })).toMatch(/exceeds/);
    expect(entryError(10000, [...entries, { kind: "refund", amountCents: 2000 }], false, { kind: "refund", amountCents: 501 })).toMatch(/exceeds/);
  });
  it("refunds do not create new debt or permit charging the same sale again", () => {
    const entries = [{ kind: "payment", amountCents: 10000 }, { kind: "refund", amountCents: 3000 }];
    expect(saleBalance(10000, entries, false)).toMatchObject({ status: "partially_refunded", outstandingCents: 0, refundedCents: 3000 });
    expect(entryError(10000, entries, false, { kind: "payment", amountCents: 1 })).toMatch(/exceeds/);
    expect(saleBalance(10000, [...entries, { kind: "refund", amountCents: 7000 }], false).status).toBe("refunded");
  });
  it("voided sales have no outstanding balance and cannot receive entries", () => {
    expect(saleBalance(10000, [], true)).toMatchObject({ status: "void", outstandingCents: 0 });
    expect(entryError(10000, [], true, { kind: "payment", amountCents: 100 })).toMatch(/voided/);
  });
});

describe("financial reporting dates", () => {
  it("accepts real inclusive dates only with a bounded range", () => {
    expect(validReportDates("2026-10-01", "2026-10-31")).toBe(true);
    expect(validReportDates("2024-02-29", "2024-02-29")).toBe(true);
    expect(validReportDates("2026-02-29", "2026-03-01")).toBe(false);
    expect(validReportDates("2026-10-02", "2026-10-01")).toBe(false);
    expect(validReportDates("bad", "2026-10-01")).toBe(false);
    expect(validReportDates("2020-01-01", "2026-10-01")).toBe(false);
  });
});
