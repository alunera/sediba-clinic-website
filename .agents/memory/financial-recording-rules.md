---
name: Financial recording boundaries
description: Manual sales versus booking payments, refund semantics and integer validation.
---

Keep manual sales separate from online bookings; reports combine manual receipts with verified booking-payment records, not booking face values.

**Why:** Entering an online booking again as a manual sale would duplicate money in reports. Recording a staff-entered payment or refund is bookkeeping only, not an instruction to a card provider. Net receipts do not equal profit or provider settlement.

**How to apply:** Make these boundaries explicit in forms and reports. Preserve financial history through additive transactions, not edits/deletes. Refunds reduce net receipts but do not reopen previously paid debt; an existing unpaid balance remains unchanged.

Appointment payments received at the clinic must attach to the existing booking, never be copied into manual sales. Partial in-salon payments retain a balance and disable new online checkout initiation; fully paid pending bookings confirm.

**Why:** Two independent payment paths could collect twice. The documented Yoco Checkout API does not provide a verified link-revocation operation we can rely on. Cancel/failure redirects do not prove a hosted link can no longer accept money.

**How to apply:** Block in-salon collection when an unresolved Yoco checkout exists, even after a failed payment event; expose the reconciliation requirement instead of guessing expiry. Persist a checkout reservation before contacting the provider so a lost response cannot permit another payment method. Do not auto-expire bookings that already have recorded receipts.

The current Orval-generated Zod validators use ordinary numbers even for OpenAPI integer fields.

**Why:** A boundary test accepted fractional cents despite an integer schema.

**How to apply:** Refine generated validators with safe-integer checks for money, quantities and IDs; do not assume the OpenAPI integer declaration is enforced at runtime.

The initial bookkeeping scope is cash-basis tracking, not full accounts. Existing receipts remain the income source; matching a bank deposit is a transfer, not another sale. Provider fees recorded with a deposit must not also be entered as standalone expenses.

**Why:** Recounting payouts as income or deducting fees twice would distort the future profit-and-loss report. Product purchases paid today are not automatically cost of goods sold today.

**How to apply:** Keep cash movement separate from profit and bank balances. Preserve voided financial records with reasons. Build unpaid-bill, stock costing and accrual treatment explicitly before presenting full accounts; manual statement matching is not an automatic bank feed or provider verification.

Appointment refunds are initially records of money already returned outside the app. They do not cancel appointments, reopen debt or reverse a previously matched bank deposit.

**Why:** Refunding money, changing appointment status and reconciling bank movements are separate actions; combining them implicitly would create incorrect balances or schedule changes.

**How to apply:** Require the original completed payment and evidence of the external refund. If provider refund synchronization is added later, reconcile against manually recorded provider refund references rather than importing the same refund as another outgoing entry.

Stock is committed when a stocked-product sale is created, not when money is collected. Neither refunds nor voiding a sale prove that usable goods returned to the clinic.

**Why:** Payment events and physical movements can occur separately. Automatically restocking a refunded product could make damaged or unreturned goods available for sale.

**How to apply:** Record an explicit physical return or correction with a reason. Keep historic untracked product sales distinct; never retroactively deduct opening stock for them. Do not treat stock quantities or selling prices as cost accounting for the queued profit reports.
