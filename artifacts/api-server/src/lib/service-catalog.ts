import {
  isPublicTreatmentName,
  normalizeTreatmentName,
  TREATMENT_MENU,
} from "@workspace/treatment-catalog";

type ExistingService = {
  id: number;
  name: string;
  category: string;
  description: string;
  duration: number;
  price: number;
};

export type CatalogServiceValues = {
  name: string;
  category: string;
  description: string;
  duration: number;
  price: number;
};

export type CatalogReconciliationPlan = {
  inserts: CatalogServiceValues[];
  updates: Array<CatalogServiceValues & { id: number }>;
};

type QueryResult<Row = Record<string, unknown>> = { rows: Row[] };
type CatalogClient = {
  query<Row = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>>;
};

export const BRANDED_SERVICE_CATALOG: readonly CatalogServiceValues[] =
  TREATMENT_MENU.flatMap<CatalogServiceValues>((category) =>
    category.treatments.map((treatment) => ({
      name: treatment.name,
      category: category.label,
      description: treatment.sub,
      duration: treatment.duration,
      price: treatment.priceCents,
    })),
  );

export function planCatalogReconciliation(
  existingServices: readonly ExistingService[],
): CatalogReconciliationPlan {
  const firstExistingByName = new Map<string, ExistingService>();
  for (const service of existingServices) {
    const normalized = normalizeTreatmentName(service.name);
    if (!firstExistingByName.has(normalized)) {
      firstExistingByName.set(normalized, service);
    }
  }

  const plan: CatalogReconciliationPlan = { inserts: [], updates: [] };
  for (const desired of BRANDED_SERVICE_CATALOG) {
    const existing = firstExistingByName.get(
      normalizeTreatmentName(desired.name),
    );
    if (!existing) {
      plan.inserts.push(desired);
      continue;
    }
    if (
      existing.category !== desired.category ||
      existing.description !== desired.description ||
      existing.duration !== desired.duration ||
      existing.price !== desired.price
    ) {
      plan.updates.push({ ...desired, id: existing.id });
    }
  }
  return plan;
}

export function publicServices<
  Service extends { name: string; category: string },
>(services: readonly Service[]): Service[] {
  const firstByName = new Map<string, Service>();
  for (const service of services) {
    const normalized = normalizeTreatmentName(service.name);
    if (!firstByName.has(normalized)) firstByName.set(normalized, service);
  }

  const branded = BRANDED_SERVICE_CATALOG.flatMap((treatment) => {
    const service = firstByName.get(normalizeTreatmentName(treatment.name));
    return service ? [service] : [];
  });
  const seenConsultations = new Set<string>();
  const consultations = services.filter((service) => {
    if (service.category.toLowerCase() !== "consultation") return false;
    const normalized = normalizeTreatmentName(service.name);
    if (seenConsultations.has(normalized)) return false;
    seenConsultations.add(normalized);
    return true;
  });
  return [...branded, ...consultations];
}

export function isServiceBookableForNewAppointment(
  service: {
    id: number;
    name: string;
    category: string;
  },
  canonicalPublicId: number | undefined,
): boolean {
  return (
    service.category.toLowerCase() === "consultation" ||
    (isPublicTreatmentName(service.name) && service.id === canonicalPublicId)
  );
}

/**
 * Reconcile the authoritative public catalog without deleting or renaming any
 * service. Appointments retain their service IDs and snapshotted totals.
 */
export async function reconcileServiceCatalog(
  client: CatalogClient,
): Promise<CatalogReconciliationPlan> {
  await client.query("BEGIN");
  try {
    // Serialize reconciliation across concurrently starting server instances.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('sediba-service-catalog-v1'))",
    );
    const existing = await client.query<ExistingService>(
      `SELECT id, name, category, description, duration, price_cents AS price
         FROM services
        ORDER BY id`,
    );
    const plan = planCatalogReconciliation(existing.rows);

    for (const service of plan.inserts) {
      await client.query(
        `INSERT INTO services
           (name, category, description, duration, price_cents)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          service.name,
          service.category,
          service.description,
          service.duration,
          service.price,
        ],
      );
    }
    for (const service of plan.updates) {
      await client.query(
        `UPDATE services
            SET category = $1, description = $2, duration = $3, price_cents = $4
          WHERE id = $5`,
        [
          service.category,
          service.description,
          service.duration,
          service.price,
          service.id,
        ],
      );
    }

    await client.query("COMMIT");
    return plan;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}