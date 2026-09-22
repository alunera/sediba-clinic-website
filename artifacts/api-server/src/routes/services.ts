import { Router } from "express";
import { db } from "@workspace/db";
import { servicesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetServiceParams } from "@workspace/api-zod";
import { publicServices } from "../lib/service-catalog";

const router = Router();

router.get("/services", async (_req, res) => {
  const services = await db.select().from(servicesTable).orderBy(servicesTable.id);
  res.json(
    publicServices(services).map((s) => ({
      ...s,
      price: s.price / 100,
    }))
  );
});

router.get("/services/categories", async (_req, res) => {
  const services = publicServices(
    await db.select().from(servicesTable).orderBy(servicesTable.id),
  );
  const counts = new Map<string, number>();
  for (const service of services) {
    counts.set(service.category, (counts.get(service.category) ?? 0) + 1);
  }
  res.json(
    [...counts].map(([category, count]) => ({ category, count })),
  );
});

router.get("/services/:id", async (req, res) => {
  const parsed = GetServiceParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [service] = await db
    .select()
    .from(servicesTable)
    .where(eq(servicesTable.id, parsed.data.id));

  if (!service) {
    res.status(404).json({ error: "Service not found" });
    return;
  }

  res.json({ ...service, price: service.price / 100 });
});

export default router;
