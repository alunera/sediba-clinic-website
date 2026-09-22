/**
 * The public Services page and booking flow both consume the same catalog that
 * the API reconciles into the database at startup.
 */
export {
  ADVANCED,
  ALL_TREATMENTS,
  BODY,
  HANDS_FEET,
  SKIN,
  TREATMENT_MENU,
  displayPrice,
  findTreatmentByName,
  menuIndex,
} from "@workspace/treatment-catalog";

export type {
  Treatment,
  TreatmentCategory,
} from "@workspace/treatment-catalog";