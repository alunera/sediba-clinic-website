import { describe, expect, it } from "vitest";
import {
  ALL_TREATMENTS,
  BODY,
  TREATMENT_MENU,
} from "@workspace/treatment-catalog";
import {
  BRANDED_SERVICE_CATALOG,
  isServiceBookableForNewAppointment,
  planCatalogReconciliation,
  publicServices,
} from "../lib/service-catalog";

describe("public service catalog", () => {
  it("keeps the API catalog aligned with the public treatment menu", () => {
    expect(BRANDED_SERVICE_CATALOG.map((service) => service.name)).toEqual(
      ALL_TREATMENTS.map((treatment) => treatment.name),
    );
    expect(BRANDED_SERVICE_CATALOG).toHaveLength(
      TREATMENT_MENU.reduce(
        (count, category) => count + category.treatments.length,
        0,
      ),
    );

    const deepRelease = BRANDED_SERVICE_CATALOG.find(
      (service) => service.name === "The Deep Release",
    );
    expect(deepRelease).toMatchObject({
      duration: 60,
      price: 50000,
      category: "Body & Wellness",
    });
    expect(
      BODY.find((treatment) => treatment.name === "The Deep Release")?.price,
    ).toBe("R500");
    expect(
      ALL_TREATMENTS.find((treatment) => treatment.name === "The Glow")?.price,
    ).toBe("From R1,000");
  });

  it("hides legacy and duplicate rows from the public listing", () => {
    const rows = [
      { id: 1, name: "Swedish Massage", category: "Massage" },
      { id: 2, name: "The Deep Release", category: "Body & Wellness" },
      { id: 3, name: "the deep release", category: "Body & Wellness" },
      { id: 4, name: "Consultation", category: "consultation" },
    ];

    expect(publicServices(rows)).toEqual([rows[1], rows[3]]);
  });

  it("rejects legacy IDs for new bookings without affecting consultation", () => {
    expect(
      isServiceBookableForNewAppointment({
        id: 1,
        name: "Swedish Massage",
        category: "Massage",
      }, undefined),
    ).toBe(false);
    expect(
      isServiceBookableForNewAppointment({
        id: 2,
        name: "The Deep Release",
        category: "Body & Wellness",
      }, 2),
    ).toBe(true);
    expect(
      isServiceBookableForNewAppointment({
        id: 3,
        name: "The Deep Release",
        category: "Body & Wellness",
      }, 2),
    ).toBe(false);
    expect(
      isServiceBookableForNewAppointment({
        id: 4,
        name: "Consultation",
        category: "consultation",
      }, 4),
    ).toBe(true);
  });

  it("is idempotent and leaves legacy rows untouched", () => {
    const legacy = {
      id: 1,
      name: "Swedish Massage",
      category: "Massage",
      description: "Legacy treatment",
      duration: 60,
      price: 50000,
    };
    const first = planCatalogReconciliation([legacy]);
    expect(first.inserts).toHaveLength(ALL_TREATMENTS.length);
    expect(first.updates).toEqual([]);

    const reconciled = [
      legacy,
      ...first.inserts.map((service, index) => ({
        ...service,
        id: index + 2,
      })),
    ];
    expect(planCatalogReconciliation(reconciled)).toEqual({
      inserts: [],
      updates: [],
    });
    expect(reconciled[0]).toEqual(legacy);
  });
});