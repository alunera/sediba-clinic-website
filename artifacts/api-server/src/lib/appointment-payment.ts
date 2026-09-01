export function appointmentRequiresPayment(totalAmountCents: number): boolean {
  return totalAmountCents > 0;
}

export function appointmentCanBeConfirmed(
  totalAmountCents: number,
  hasCompletedPayment: boolean,
): boolean {
  return !appointmentRequiresPayment(totalAmountCents) || hasCompletedPayment;
}