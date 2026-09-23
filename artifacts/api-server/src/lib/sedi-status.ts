import { appointmentsTable, db, paymentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  deriveAdminPaymentStatus,
  type AdminPaymentStatus,
} from "./admin-payment-status";
import { appointmentRequiresPayment } from "./appointment-payment";

type StatusAppointment = {
  id: number;
  status: string;
  totalAmountCents: number;
};

type StatusPaymentAttempt = {
  appointmentId: number;
  id: number;
  status: string;
};

export type AuthorizedStatusLookup = {
  appointmentId: number;
  ownershipVerified: true;
};

export type InternalBookingPaymentStatus = {
  appointmentId: number;
  bookingStatus: string;
  paymentStatus: AdminPaymentStatus;
  confirmed: boolean;
};

export type SediStatusDependencies = {
  appointment: (appointmentId: number) => Promise<StatusAppointment | undefined>;
  paymentAttempts: (appointmentId: number) => Promise<StatusPaymentAttempt[]>;
};

const defaultDependencies: SediStatusDependencies = {
  appointment: async (appointmentId) => {
    const [appointment] = await db
      .select({
        id: appointmentsTable.id,
        status: appointmentsTable.status,
        totalAmountCents: appointmentsTable.totalAmountCents,
      })
      .from(appointmentsTable)
      .where(eq(appointmentsTable.id, appointmentId))
      .limit(1);
    return appointment;
  },
  paymentAttempts: (appointmentId) =>
    db
      .select({
        appointmentId: paymentsTable.appointmentId,
        id: paymentsTable.id,
        status: paymentsTable.status,
      })
      .from(paymentsTable)
      .where(eq(paymentsTable.appointmentId, appointmentId))
      .orderBy(paymentsTable.id),
};

/**
 * Internal, read-only adapter. Callers must verify booking ownership before
 * constructing the lookup. It intentionally returns no booking reference or PII
 * and is not exposed through an HTTP route or Sedi tool.
 */
export async function readAuthorizedBookingPaymentStatus(
  lookup: AuthorizedStatusLookup,
  dependencies: SediStatusDependencies = defaultDependencies,
): Promise<InternalBookingPaymentStatus | undefined> {
  if (lookup.ownershipVerified !== true) {
    throw new Error("Booking ownership must be verified before status lookup.");
  }

  const appointment = await dependencies.appointment(lookup.appointmentId);
  if (!appointment) return undefined;

  const attempts = await dependencies.paymentAttempts(appointment.id);
  const paymentStatus = deriveAdminPaymentStatus(attempts, appointment.status);
  const paymentSatisfied =
    !appointmentRequiresPayment(appointment.totalAmountCents) ||
    paymentStatus === "paid";

  return {
    appointmentId: appointment.id,
    bookingStatus: appointment.status,
    paymentStatus,
    confirmed: appointment.status === "confirmed" && paymentSatisfied,
  };
}