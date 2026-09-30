---
name: Salonbridge transition sequencing
description: Why client records precede sales, reporting and birthday automation.
---

Build the Salonbridge replacement incrementally on the existing Sediba booking/payment system, starting with persistent client profiles.

**Why:** The clinic uses bookings, client records, sales, financial reports, birthdays and confirmations. A booking-derived directory is not a reliable identity foundation for sales attribution or birthdays. These capabilities must be verified separately before describing the system as a complete replacement.

**How to apply:** Distinguish stored birth dates from permission to send birthday marketing, booking values from verified payments, and provider delivery code from configured, tested messaging. Do not assume historical Salonbridge data can be imported without inspecting an actual export.