import { RecordAppointmentRefundBody } from "@workspace/api-zod";

export const refundInput = RecordAppointmentRefundBody.refine(d =>
  Number.isSafeInteger(d.amountCents) && Number.isSafeInteger(d.paymentId) &&
  !!d.reason.trim() && !!d.reference.trim() && d.returned === true,
  { message: "Confirm money was returned and provide a receipt, integer amount, reason and reference." },
).transform(d => ({ ...d, reference: d.reference.trim(), reason: d.reason.trim() }));

export function refundBalance(paidCents: number, refunds: { amountCents: number }[]) {
  const refundedCents = refunds.reduce((sum, r) => sum + r.amountCents, 0);
  return { refundedCents, netReceiptsCents: paidCents - refundedCents };
}
export function refundError(
  payment: { status: string; provider: string; amountCents: number },
  refundedCents: number,
  input: { amountCents: number; method: string },
) {
  if (payment.status !== "complete") return "Only a completed payment can have a recorded refund.";
  if (input.method === "yoco" && payment.provider !== "yoco") return "A Yoco-dashboard refund must refer to an online Yoco payment.";
  if (input.amountCents > payment.amountCents - refundedCents) return "Refund exceeds the amount still refundable on this payment. Refresh the history.";
  return null;
}
