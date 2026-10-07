---
name: Salonbridge transition sequencing
description: Why client records precede sales, reporting and birthday automation.
---

Build the Salonbridge replacement incrementally on the existing Sediba booking/payment system, starting with persistent client profiles.

**Why:** The clinic uses bookings, client records, sales, financial reports, birthdays and confirmations. A booking-derived directory is not a reliable identity foundation for sales attribution or birthdays. These capabilities must be verified separately before describing the system as a complete replacement.

**How to apply:** Distinguish stored birth dates from permission to send birthday marketing, booking values from verified payments, and provider delivery code from configured, tested messaging. Do not assume historical Salonbridge data can be imported without inspecting an actual export.

The user specified bookkeeping, profit & loss, product reporting and WhatsApp/Google review messaging, then chose manual messaging instead of paid automation.

**Why:** After comparing provider subscriptions and setup requirements, the user said “lets go manual.”

**How to apply:** Prepare confirmation, reminder and review-request messages for staff to review and send in WhatsApp. No paid provider, automated delivery or false delivery tracking. Do not reactivate automation just because credentials exist or an older task mentions it. Do not send real messages during testing.

Keep the clinic's current number working in the WhatsApp Business phone app when adding automation.

**Why:** The user explicitly chose to keep the current number working in the phone app.

**How to apply:** Require a verified coexistence onboarding route before connecting that number to an API. Do not delete the WhatsApp account or use a migration that removes phone-app access. Provider subscriptions need the user's approval; earlier message-only estimates exclude coexistence-provider charges.

Leave receipt printing out for now.

**Why:** The user asked to defer it.

**How to apply:** Do not include receipt printing in the remaining-work priorities or do further printing work unless the user brings it back into scope.

Leave galleries out. The user confirmed that domain transfer is done.

**Why:** The user explicitly removed galleries from scope and confirmed the domain-transfer status.

**How to apply:** Do not include galleries or domain transfer in the remaining build work. This does not replace verification of newly released features on the live website.

The user instructed: “stop publishin the app, disable the app.”

**Why:** The user asked to stop publishing and disable this app.

**How to apply:** Do not publish, suggest publishing, or restart app workflows without a new user instruction authorizing it. Stopping workspace workflows does not shut down the published deployment; that requires the Publishing shutdown action.