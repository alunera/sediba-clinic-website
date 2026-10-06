---
name: Financial recording boundaries
description: Manual sales versus booking payments, refund semantics and integer validation.
---

Keep manual sales separate from online bookings; reports combine manual receipts with verified booking-payment records, not booking face values.

**Why:** Entering an online booking again as a manual sale would duplicate money in reports. Recording a staff-entered payment or refund is bookkeeping only, not an instruction to a card provider. Net receipts do not equal profit or provider settlement.

**How to apply:** Make these boundaries explicit in forms and reports. Preserve financial history through additive transactions, not edits/deletes. Refunds reduce net receipts but do not reopen previously paid debt; an existing unpaid balance remains unchanged.

The current Orval-generated Zod validators use ordinary numbers even for OpenAPI integer fields.

**Why:** A boundary test accepted fractional cents despite an integer schema.

**How to apply:** Refine generated validators with safe-integer checks for money, quantities and IDs; do not assume the OpenAPI integer declaration is enforced at runtime.
