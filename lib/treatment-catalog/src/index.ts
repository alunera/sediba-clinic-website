export type Treatment = {
  name: string;
  sub: string;
  price: string;
  priceCents: number;
  duration: number;
};

export type TreatmentCategory = {
  label: string;
  treatments: readonly Treatment[];
};

export const SKIN = [
  { name: "The Glow", sub: "Radiance · Hydration · Refresh", price: "From R1,000", priceCents: 100000, duration: 60 },
  { name: "The Clarify", sub: "Congestion · Breakouts · Balance", price: "From R1,000", priceCents: 100000, duration: 60 },
  { name: "The Brighten", sub: "Pigmentation · Tone · Luminosity", price: "From R1,000", priceCents: 100000, duration: 60 },
  { name: "The Firm", sub: "Fine Lines · Firmness · Collagen", price: "From R1,000", priceCents: 100000, duration: 60 },
  { name: "The Calm", sub: "Sensitivity · Redness · Barrier Support", price: "From R1,000", priceCents: 100000, duration: 60 },
  { name: "The Renew", sub: "Resurfacing · Texture · Skin Renewal", price: "From R1,000", priceCents: 100000, duration: 60 },
  { name: "The Lift", sub: "Firming · Definition · Rejuvenation", price: "From R1,000", priceCents: 100000, duration: 60 },
  { name: "The Repair", sub: "Regeneration · Recovery · Skin Restoration", price: "From R1,000", priceCents: 100000, duration: 60 },
] as const satisfies readonly Treatment[];

export const ADVANCED = [
  { name: "The Precision Peel", sub: "Targeted Resurfacing · Pigmentation · Texture", price: "From R1,250", priceCents: 125000, duration: 60 },
  { name: "The Collagen Boost", sub: "Microneedling · Texture · Fine Lines", price: "From R990", priceCents: 99000, duration: 60 },
  { name: "The Regeneration (Exosome)", sub: "Exosome Therapy · Repair · Rejuvenation", price: "From R2,500", priceCents: 250000, duration: 75 },
  { name: "The Perfect Polish", sub: "Dermaplaning · Smoothness · Radiance", price: "From R850", priceCents: 85000, duration: 45 },
  { name: "The Light Therapy", sub: "LED · Calm · Repair", price: "R1,750", priceCents: 175000, duration: 30 },
  { name: "The Smooth", sub: "Laser Hair Removal · All Skin Types", price: "From R450", priceCents: 45000, duration: 30 },
  { name: "The Clear", sub: "Laser Tattoo Removal", price: "From R450", priceCents: 45000, duration: 30 },
  { name: "The Contour", sub: "Cavitation · Body Contouring", price: "From R550", priceCents: 55000, duration: 45 },
] as const satisfies readonly Treatment[];

export const BODY = [
  { name: "The Sediba Signature", sub: "Full-Body Relaxation · Restore · Rebalance", price: "R750", priceCents: 75000, duration: 60 },
  { name: "The Deep Release", sub: "Deep Tissue · Muscle Tension · Recovery", price: "R500", priceCents: 50000, duration: 60 },
  { name: "The Reset", sub: "Back · Neck · Shoulders", price: "R450", priceCents: 45000, duration: 30 },
  { name: "The Aroma Ritual", sub: "Aromatherapy · Relaxation · Wellbeing", price: "R800", priceCents: 80000, duration: 60 },
  { name: "Add-On Massage", sub: "Hand or Foot Massage (Add-On)", price: "R350", priceCents: 35000, duration: 15 },
] as const satisfies readonly Treatment[];

export const HANDS_FEET = [
  { name: "The Manicure", sub: "Shape · Cuticle Care · Polish", price: "R350", priceCents: 35000, duration: 45 },
  { name: "The Gel Manicure", sub: "Long-Wear · High Shine", price: "R400", priceCents: 40000, duration: 60 },
  { name: "The Pedicure", sub: "Foot Care · Shape · Polish", price: "R420", priceCents: 42000, duration: 45 },
  { name: "The Gel Pedicure", sub: "Long-Wear · High Shine", price: "R620", priceCents: 62000, duration: 60 },
  { name: "The Luxury Hand Ritual", sub: "Exfoliate · Nourish · Massage", price: "R350", priceCents: 35000, duration: 30 },
  { name: "The Luxury Foot Ritual", sub: "Exfoliate · Restore · Massage", price: "R350", priceCents: 35000, duration: 30 },
] as const satisfies readonly Treatment[];

export const TREATMENT_MENU = [
  { label: "Skin", treatments: SKIN },
  { label: "Advanced Aesthetics", treatments: ADVANCED },
  { label: "Body & Wellness", treatments: BODY },
  { label: "Hands & Feet", treatments: HANDS_FEET },
] as const satisfies readonly TreatmentCategory[];

export const ALL_TREATMENTS: readonly Treatment[] = TREATMENT_MENU.flatMap<Treatment>(
  (category) => [...category.treatments],
);

export const normalizeTreatmentName = (name: string): string =>
  name.trim().toLocaleLowerCase("en-ZA");

const treatmentsByName = new Map(
  ALL_TREATMENTS.map((treatment) => [
    normalizeTreatmentName(treatment.name),
    treatment,
  ]),
);

export function findTreatmentByName(
  name: string | null | undefined,
): Treatment | undefined {
  return name ? treatmentsByName.get(normalizeTreatmentName(name)) : undefined;
}

export function isPublicTreatmentName(name: string): boolean {
  return treatmentsByName.has(normalizeTreatmentName(name));
}

export function displayPrice(name: string, apiPriceRand: number): string {
  return findTreatmentByName(name)?.price ?? `R${apiPriceRand.toFixed(2)}`;
}

export function menuIndex(name: string): number {
  const normalized = normalizeTreatmentName(name);
  const index = ALL_TREATMENTS.findIndex(
    (treatment) => normalizeTreatmentName(treatment.name) === normalized,
  );
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}