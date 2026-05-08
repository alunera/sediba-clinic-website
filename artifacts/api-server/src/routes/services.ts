import { Router } from "express";
import { db } from "@workspace/db";
import { servicesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { GetServiceParams } from "@workspace/api-zod";

const router = Router();

router.get("/services", async (_req, res) => {
  const services = await db.select().from(servicesTable).orderBy(servicesTable.category);
  res.json(
    services.map((s) => ({
      ...s,
      price: s.price / 100,
    }))
  );
});

router.get("/services/categories", async (_req, res) => {
  const categories = await db
    .select({
      category: servicesTable.category,
      count: sql<number>`count(*)::int`,
    })
    .from(servicesTable)
    .groupBy(servicesTable.category)
    .orderBy(servicesTable.category);

  res.json(categories);
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
