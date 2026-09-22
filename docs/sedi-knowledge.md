# Sedi approved knowledge and gaps

## Confirmed sources

- Treatment names, menu categories, descriptions, displayed prices and durations are loaded at request time from `@workspace/treatment-catalog`; they are not copied into Sedi.
- Live appointment slots come from the existing `availability_slots` and non-cancelled `appointments` data through the same availability service used by the appointments API.
- The rendered About page confirms: Hertford Office Park, Building M, Waterfall, Midrand; Monday-Friday 09:00-18:00, Saturday 10:00-15:00, Sunday closed; 081 456 6402; and info@sedibawellnessclinic.co.za.
- The rendered Services page confirms a 30-minute Skin Consultation displayed at R350 and links to `/book-consultation`. Sedi reads the current consultation price and duration from the live consultation service row so admin changes are respected.
- The existing treatment booking form confirms: 100% payment is required to secure an appointment; cancellation with less than 24 hours' notice forfeits the full booking amount; rescheduling requires at least 24 hours' notice; and clients should arrive 5 minutes early. Policy acceptance or a prepared handoff is not booking/payment confirmation.
- Founder-confirmed commonly asked services: Microneedling, Chemical Peels and Massages only.

## Missing or requiring clinic confirmation

- Full street address beyond the confirmed park/building/area.
- Medical-aid policy and gift-card availability.
- Treatment-specific preparation, aftercare, pain/discomfort, downtime, expected results and session guidance.
- Which treatments require prior consultation and any contraindication/suitability rules.
- Any promotions, discounts or additional clinic policies beyond the existing booking form.
- Parking and product-brand claims are intentionally not included in Sedi's approved prompt pending explicit business confirmation.

Sedi must hand these gaps to a practitioner/team member via 081 456 6402, info@sedibawellnessclinic.co.za, or the existing consultation form rather than infer an answer.