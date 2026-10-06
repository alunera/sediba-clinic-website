import { describe, expect, it } from "vitest";
import { expenseInput, depositInput, bookVoidInput, depositError, clinicToday } from "../lib/bookkeeping";

const expense = { requestId: "book-test-request-id", date: "2026-01-01", category: "rent", payee: "Landlord",
  reference: "Jan rent", amountCents: 50000, method: "eft", paid: true };
const deposit = { requestId: "book-deposit-test-id", date: "2026-01-01", reference: "Bank ref",
  bankCents: 9700, feeCents: 300, receiptKeys: ["sale:1","booking:2"], verified: true };
describe("bookkeeping boundaries", () => {
  it("validates paid expenses and clinic dates", () => {
    expect(expenseInput.safeParse(expense).success).toBe(true);
    expect(clinicToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const patch of [{ amountCents: 0 }, { amountCents: 1.2 }, { amountCents: 100000001 },
      { date: "2099-01-01" }, { date: "2026-02-30" }, { payee: " " }, { reference: " " },
      { category: "invalid" }, { paid: false }]) {
      expect(expenseInput.safeParse({ ...expense,...patch }).success).toBe(false);
    }
  });
  it("requires uniquely identified receipts, integer fees, and explicit verification", () => {
    expect(depositInput.safeParse(deposit).success).toBe(true);
    for (const patch of [{ bankCents: 0 }, { bankCents: 2.1 }, { feeCents: -1 }, { feeCents: 0.5 },
      { receiptKeys: [] }, { receiptKeys: ["sale:1","sale:1"] }, { receiptKeys: ["expense:1"] },
      { receiptKeys: ["sale:0"] }, { verified: false }, { reference: " " }]) {
      expect(depositInput.safeParse({ ...deposit,...patch }).success).toBe(false);
    }
  });
  it("requires an exact deposit/fee match and no receipt after the deposit date", () => {
    const receipts = [{ date: "2026-01-01", amountCents: 6000 }, { date: "2026-01-01", amountCents: 4000 }];
    expect(depositError(deposit, receipts)).toBe(null);
    expect(depositError({ ...deposit,bankCents: 9701 }, receipts)).toMatch(/exactly/);
    expect(depositError({ ...deposit,date: "2025-12-31" }, receipts)).toMatch(/precede/);
    expect(bookVoidInput.safeParse({ reason: " " }).success).toBe(false);
    expect(bookVoidInput.parse({ reason: " correction " }).reason).toBe("correction");
  });
});
