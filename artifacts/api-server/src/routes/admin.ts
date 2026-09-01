import { Router } from "express";
import { db } from "@workspace/db";
import { appointmentsTable, servicesTable, adminConfigTable, paymentsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/admin-auth";
import { logger } from "../lib/logger";
import {
  deriveAdminPaymentStatus,
  groupPaymentAttempts,
} from "../lib/admin-payment-status";
import {
  appointmentCanBeConfirmed,
  appointmentRequiresPayment,
} from "../lib/appointment-payment";

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
  const [appointments, paymentAttempts] = await Promise.all([
    db
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
        appointmentType: appointmentsTable.appointmentType,
        createdAt: appointmentsTable.createdAt,
      })
      .from(appointmentsTable)
      .leftJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
      .orderBy(appointmentsTable.date),
    db
      .select({
        id: paymentsTable.id,
        appointmentId: paymentsTable.appointmentId,
        status: paymentsTable.status,
      })
      .from(paymentsTable)
      .orderBy(paymentsTable.id),
  ]);
  const attemptsByAppointment = groupPaymentAttempts(paymentAttempts);

  res.json(
    appointments.map((appointment) => ({
      ...appointment,
      paymentStatus: deriveAdminPaymentStatus(
        attemptsByAppointment.get(appointment.id) ?? [],
        appointment.status,
      ),
    })),
  );
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

  if (status === "confirmed") {
    const [current] = await db
      .select({
        status: appointmentsTable.status,
        totalAmountCents: appointmentsTable.totalAmountCents,
      })
      .from(appointmentsTable)
      .where(eq(appointmentsTable.id, id))
      .limit(1);

    if (
      current &&
      current.status !== "confirmed" &&
      appointmentRequiresPayment(current.totalAmountCents)
    ) {
      const [paid] = await db
        .select({ id: paymentsTable.id })
        .from(paymentsTable)
        .where(
          and(
            eq(paymentsTable.appointmentId, id),
            eq(paymentsTable.status, "complete"),
          ),
        )
        .limit(1);
      if (!appointmentCanBeConfirmed(current.totalAmountCents, Boolean(paid))) {
        res.status(409).json({
          error:
            "This booking has not been paid. It can only be confirmed automatically once payment is verified.",
        });
        return;
      }
    }
  }

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

/* ── Admin Consultation Service ───────────────────────────────────────────── */

router.get("/admin/consultation", requireAdmin, async (req, res): Promise<void> => {
  const [service] = await db
    .select()
    .from(servicesTable)
    .where(eq(servicesTable.category, "consultation"))
    .limit(1);

  if (!service) {
    res.status(404).json({ error: "Consultation service not found" });
    return;
  }

  res.json({
    id: service.id,
    durationMinutes: service.duration,
    priceRands: service.price / 100,
  });
});

router.put("/admin/consultation", requireAdmin, async (req, res): Promise<void> => {
  const { durationMinutes, priceRands } = req.body as { durationMinutes?: unknown; priceRands?: unknown };

  const duration = Number(durationMinutes);
  const priceRandsNum = Number(priceRands);

  if (!Number.isFinite(duration) || duration < 1) {
    res.status(400).json({ error: "durationMinutes must be a positive integer" });
    return;
  }
  if (!Number.isFinite(priceRandsNum) || priceRandsNum < 0) {
    res.status(400).json({ error: "priceRands must be a non-negative number" });
    return;
  }

  const priceCents = Math.round(priceRandsNum * 100);

  const [existing] = await db
    .select({ id: servicesTable.id })
    .from(servicesTable)
    .where(eq(servicesTable.category, "consultation"))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Consultation service not found" });
    return;
  }

  const [updated] = await db
    .update(servicesTable)
    .set({ duration: Math.round(duration), price: priceCents })
    .where(eq(servicesTable.id, existing.id))
    .returning();

  logger.info({ id: existing.id, duration, priceCents }, "Consultation service updated");

  res.json({
    id: updated!.id,
    durationMinutes: updated!.duration,
    priceRands: updated!.price / 100,
  });
});

export default router;
