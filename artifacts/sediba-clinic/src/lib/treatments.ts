/**
 * Single source of truth for the treatment menu shown on the Services page
 * and in the Booking flow. The database services table is kept in sync with
 * this list (same names); this file provides the display price strings
 * (e.g. "From R1,000") used on both pages so they can never diverge.
 */

export type Treatment = {
  name: string;
  sub: string;
  price: string; // display string, e.g. "From R1,000" or "R750"
};

export type TreatmentCategory = {
  label: string;
  treatments: Treatment[];
};

export const SKIN: Treatment[] = [
  { name: "The Glow",     sub: "Radiance · Hydration · Refresh",             price: "From R1,000" },
  { name: "The Clarify",  sub: "Congestion · Breakouts · Balance",           price: "From R1,000" },
  { name: "The Brighten", sub: "Pigmentation · Tone · Luminosity",           price: "From R1,000" },
  { name: "The Firm",     sub: "Fine Lines · Firmness · Collagen",           price: "From R1,000" },
  { name: "The Calm",     sub: "Sensitivity · Redness · Barrier Support",    price: "From R1,000" },
  { name: "The Renew",    sub: "Resurfacing · Texture · Skin Renewal",       price: "From R1,000" },
  { name: "The Lift",     sub: "Firming · Definition · Rejuvenation",        price: "From R1,000" },
  { name: "The Repair",   sub: "Regeneration · Recovery · Skin Restoration", price: "From R1,000" },
];

export const ADVANCED: Treatment[] = [
  { name: "The Precision Peel",         sub: "Targeted Resurfacing · Pigmentation · Texture", price: "From R1,250" },
  { name: "The Collagen Boost",         sub: "Microneedling · Texture · Fine Lines",          price: "From R990"   },
  { name: "The Regeneration (Exosome)", sub: "Exosome Therapy · Repair · Rejuvenation",       price: "From R2,500" },
  { name: "The Perfect Polish",         sub: "Dermaplaning · Smoothness · Radiance",          price: "From R850"   },
  { name: "The Light Therapy",          sub: "LED · Calm · Repair",                           price: "R1,750"      },
  { name: "The Smooth",                 sub: "Laser Hair Removal · All Skin Types",           price: "From R450"   },
  { name: "The Clear",                  sub: "Laser Tattoo Removal",                          price: "From R450"   },
  { name: "The Contour",                sub: "Cavitation · Body Contouring",                  price: "From R550"   },
];

export const BODY: Treatment[] = [
  { name: "The Sediba Signature", sub: "Full-Body Relaxation · Restore · Rebalance", price: "R750" },
  { name: "The Deep Release",     sub: "Deep Tissue · Muscle Tension · Recovery",    price: "R500" },
  { name: "The Reset",            sub: "Back · Neck · Shoulders",                    price: "R450" },
  { name: "The Aroma Ritual",     sub: "Aromatherapy · Relaxation · Wellbeing",      price: "R800" },
  { name: "Add-On Massage",       sub: "Hand or Foot Massage (Add-On)",              price: "R350" },
];

export const HANDS_FEET: Treatment[] = [
  { name: "The Manicure",           sub: "Shape · Cuticle Care · Polish", price: "R350" },
  { name: "The Gel Manicure",       sub: "Long-Wear · High Shine",        price: "R400" },
  { name: "The Pedicure",           sub: "Foot Care · Shape · Polish",    price: "R420" },
  { name: "The Gel Pedicure",       sub: "Long-Wear · High Shine",        price: "R620" },
  { name: "The Luxury Hand Ritual", sub: "Exfoliate · Nourish · Massage", price: "R350" },
  { name: "The Luxury Foot Ritual", sub: "Exfoliate · Restore · Massage", price: "R350" },
];

export const TREATMENT_MENU: TreatmentCategory[] = [
  { label: "Skin",                treatments: SKIN },
  { label: "Advanced Aesthetics", treatments: ADVANCED },
  { label: "Body & Wellness",     treatments: BODY },
  { label: "Hands & Feet",        treatments: HANDS_FEET },
];

/** Flat list in menu order, used for sorting and lookups. */
export const ALL_TREATMENTS: Treatment[] = TREATMENT_MENU.flatMap((c) => c.treatments);

const normalize = (s: string) => s.trim().toLowerCase();

/** Case-insensitive lookup of a treatment by name; returns undefined if not on the menu. */
export function findTreatmentByName(name: string | null | undefined): Treatment | undefined {
  if (!name) return undefined;
  const n = normalize(name);
  return ALL_TREATMENTS.find((t) => normalize(t.name) === n);
}

/** Display price for a service name: menu string if known, otherwise a formatted rand amount. */
export function displayPrice(name: string, apiPriceRand: number): string {
  return findTreatmentByName(name)?.price ?? `R${apiPriceRand.toFixed(2)}`;
}

/** Menu position for ordering the booking dropdown; unknown names sort last. */
export function menuIndex(name: string): number {
  const n = normalize(name);
  const i = ALL_TREATMENTS.findIndex((t) => normalize(t.name) === n);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}
