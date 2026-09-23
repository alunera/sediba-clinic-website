# Sedi booking/payment status preparation

## Existing source of truth

- Booking state lives on `appointments.status`.
- Payment attempts live in `payments`; `complete` is written only after the existing Yoco webhook signature, amount, currency and linkage checks succeed.
- The admin appointment view already derives `paid`, `pending`, `failed` or `unpaid` with `deriveAdminPaymentStatus`. This remains the shared derivation; no second status or payment system was added.

## Internal boundary

`readAuthorizedBookingPaymentStatus` is a read-only, internal adapter over those tables. It requires an appointment ID that a future caller has already ownership-verified, returns no client PII or booking reference, and reports `confirmed: true` only when appointment state is confirmed and required payment is stored as complete. It has no public route and is not a Sedi tool.

## Limitation

There is not yet an approved customer-ownership verification flow for conversational status lookup. Until one exists, Sedi must not call this adapter or confirm a user's payment/booking claim. A future adapter may use it only after securely resolving and verifying ownership of the appointment; the Yoco checkout and signed webhook flow must remain unchanged.