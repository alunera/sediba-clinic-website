export type AdminPaymentStatus = "paid" | "pending" | "failed" | "unpaid";

type PaymentAttempt = {
  appointmentId: number;
  id: number;
  status: string;
};

export function groupPaymentAttempts(
  attempts: PaymentAttempt[],
): Map<number, PaymentAttempt[]> {
  const grouped = new Map<number, PaymentAttempt[]>();

  for (const attempt of attempts) {
    const existing = grouped.get(attempt.appointmentId) ?? [];
    existing.push(attempt);
    grouped.set(attempt.appointmentId, existing);
  }

  return grouped;
}

export function deriveAdminPaymentStatus(
  attempts: PaymentAttempt[],
  bookingStatus: string,
): AdminPaymentStatus {
  if (attempts.some((attempt) => attempt.status === "complete")) {
    return "paid";
  }

  const latestAttempt = attempts.reduce<PaymentAttempt | undefined>(
    (latest, attempt) => (!latest || attempt.id > latest.id ? attempt : latest),
    undefined,
  );

  if (latestAttempt?.status === "failed" || latestAttempt?.status === "cancelled") {
    return "failed";
  }

  if (latestAttempt || bookingStatus === "pending_payment") {
    return "pending";
  }

  if (bookingStatus === "payment_failed") {
    return "failed";
  }

  return "unpaid";
}