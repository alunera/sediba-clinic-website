import { Router } from "express";
import { db } from "@workspace/db";
import { appointmentsTable, servicesTable, adminConfigTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/admin-auth";
import { logger } from "../lib/logger";

const router = Router();

/* ── Auth ─────────────────────────────────────────────────────────────────── */

router.post("/admin/login", async (req, res): Promise<void> => {
  const { password } = req.body as { password?: string };
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    req.log.warn("ADMIN_PASSWORD env var not set");
    res.status(500).json({ error: "Admin not configured. Set ADMIN_PASSWORD environment variable." });
    return;
  }

  if (!password || password !== adminPassword) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }

  (req.session as { adminAuthenticated?: boolean }).adminAuthenticated = true;
  req.log.info("Admin logged in");
  res.json({ authenticated: true });
});

router.post("/admin/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ authenticated: false });
  });
});

router.get("/admin/me", (req, res): void => {
  const session = req.session as { adminAuthenticated?: boolean };
  if (session.adminAuthenticated) {
    res.json({ authenticated: true });
  } else {
    res.status(401).json({ error: "Not authenticated" });
  }
});

/* ── Admin Appointments ───────────────────────────────────────────────────── */

router.get("/admin/appointments", requireAdmin, async (req, res): Promise<void> => {
  const appointments = await db
    .select({
      id: appointmentsTable.id,
      bookingRef: appointmentsTable.bookingRef,
      clientName: appointmentsTable.clientName,
      clientEmail: appointmentsTable.clientEmail,
      clientPhone: appointmentsTable.clientPhone,
      clientWhatsapp: appointmentsTable.clientWhatsapp,
      serviceId: appointmentsTable.serviceId,
      serviceName: servicesTable.name,
      date: appointmentsTable.date,
      time: appointmentsTable.time,
      totalAmountCents: appointmentsTable.totalAmountCents,
      status: appointmentsTable.status,
      notes: appointmentsTable.notes,
      policyAgreed: appointmentsTable.policyAgreed,
      createdAt: appointmentsTable.createdAt,
    })
    .from(appointmentsTable)
    .leftJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
    .orderBy(appointmentsTable.date);

  res.json(appointments);
});

router.patch("/admin/appointments/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const { status, notes } = req.body as { status?: string; notes?: string };
  const updateData: Record<string, unknown> = {};
  if (status) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes;

  const [updated] = await db
    .update(appointmentsTable)
    .set(updateData)
    .where(eq(appointmentsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  const service = await db
    .select({ name: servicesTable.name })
    .from(servicesTable)
    .where(eq(servicesTable.id, updated.serviceId))
    .limit(1);

  res.json({ ...updated, serviceName: service[0]?.name ?? "" });
});

/* ── Admin Clients ────────────────────────────────────────────────────────── */

router.get("/admin/clients", requireAdmin, async (req, res): Promise<void> => {
  // Derive unique clients from appointments
  const rows = await db
    .select({
      clientName: appointmentsTable.clientName,
      clientEmail: appointmentsTable.clientEmail,
      clientPhone: appointmentsTable.clientPhone,
      clientWhatsapp: appointmentsTable.clientWhatsapp,
      appointmentCount: sql<number>`count(*)::int`,
      totalSpentCents: sql<number>`sum(${appointmentsTable.totalAmountCents})::int`,
      lastVisit: sql<string>`max(${appointmentsTable.date})`,
      firstVisit: sql<string>`min(${appointmentsTable.date})`,
    })
    .from(appointmentsTable)
    .groupBy(
      appointmentsTable.clientEmail,
      appointmentsTable.clientName,
      appointmentsTable.clientPhone,
      appointmentsTable.clientWhatsapp,
    )
    .orderBy(sql`max(${appointmentsTable.createdAt}) desc`);

  res.json(rows);
});

/* ── Admin Settings ───────────────────────────────────────────────────────── */

const SETTINGS_KEYS = ["googleReviewUrl", "clinicName", "clinicAddress", "clinicPhone", "clinicEmail", "workingHours"];

router.get("/admin/settings", requireAdmin, async (req, res): Promise<void> => {
  const rows = await db.select().from(adminConfigTable);
  const settings: Record<string, string | null> = {};
  for (const key of SETTINGS_KEYS) {
    settings[key] = rows.find(r => r.key === key)?.value ?? null;
  }
  res.json(settings);
});

router.put("/admin/settings", requireAdmin, async (req, res): Promise<void> => {
  const body = req.body as Record<string, string>;
  const settings: Record<string, string | null> = {};

  for (const key of SETTINGS_KEYS) {
    if (body[key] !== undefined) {
      await db
        .insert(adminConfigTable)
        .values({ key, value: body[key] })
        .onConflictDoUpdate({ target: adminConfigTable.key, set: { value: body[key] } });
      settings[key] = body[key];
    }
  }

  // Return merged settings
  const rows = await db.select().from(adminConfigTable);
  for (const k of SETTINGS_KEYS) {
    settings[k] = rows.find(r => r.key === k)?.value ?? null;
  }
  res.json(settings);
});

export default router;
