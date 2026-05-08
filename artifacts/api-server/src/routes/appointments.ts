import { Router } from "express";
import { db } from "@workspace/db";
import { appointmentsTable, servicesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateAppointmentBody,
  GetAppointmentParams,
  UpdateAppointmentParams,
  UpdateAppointmentBody,
  DeleteAppointmentParams,
  GetAvailabilityQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/appointments", async (req, res) => {
  const appointments = await db
    .select({
      id: appointmentsTable.id,
      clientName: appointmentsTable.clientName,
      clientEmail: appointmentsTable.clientEmail,
      clientPhone: appointmentsTable.clientPhone,
      serviceId: appointmentsTable.serviceId,
      serviceName: servicesTable.name,
      date: appointmentsTable.date,
      time: appointmentsTable.time,
      status: appointmentsTable.status,
      notes: appointmentsTable.notes,
      createdAt: appointmentsTable.createdAt,
    })
    .from(appointmentsTable)
    .leftJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
    .orderBy(appointmentsTable.date);

  res.json(appointments);
});

router.post("/appointments", async (req, res) => {
  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { serviceId, date, ...rest } = parsed.data;
  const service = await db
    .select()
    .from(servicesTable)
    .where(eq(servicesTable.id, serviceId))
    .limit(1);

  if (!service[0]) {
    res.status(400).json({ error: "Service not found" });
    return;
  }

  const dateStr = date instanceof Date ? date.toISOString().split("T")[0] : String(date);

  const [appointment] = await db
    .insert(appointmentsTable)
    .values({ ...rest, serviceId, date: dateStr })
    .returning();

  res.status(201).json({
    ...appointment,
    serviceName: service[0].name,
  });
});

router.get("/appointments/availability", async (req, res) => {
  const parsed = GetAvailabilityQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const timeSlots = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
    "11:00", "11:30", "12:00", "13:00", "13:30", "14:00",
    "14:30", "15:00", "15:30", "16:00", "16:30", "17:00",
  ];

  const dateStr = parsed.data.date instanceof Date
    ? parsed.data.date.toISOString().split("T")[0]
    : String(parsed.data.date);

  const existing = await db
    .select({ time: appointmentsTable.time })
    .from(appointmentsTable)
    .where(eq(appointmentsTable.date, dateStr));

  const bookedTimes = new Set(existing.map((a) => a.time));

  const slots = timeSlots.map((time) => ({
    time,
    available: !bookedTimes.has(time),
  }));

  res.json(slots);
});

router.get("/appointments/:id", async (req, res) => {
  const parsed = GetAppointmentParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const rows = await db
    .select({
      id: appointmentsTable.id,
      clientName: appointmentsTable.clientName,
      clientEmail: appointmentsTable.clientEmail,
      clientPhone: appointmentsTable.clientPhone,
      serviceId: appointmentsTable.serviceId,
      serviceName: servicesTable.name,
      date: appointmentsTable.date,
      time: appointmentsTable.time,
      status: appointmentsTable.status,
      notes: appointmentsTable.notes,
      createdAt: appointmentsTable.createdAt,
    })
    .from(appointmentsTable)
    .leftJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
    .where(eq(appointmentsTable.id, parsed.data.id));

  if (!rows[0]) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  res.json(rows[0]);
});

router.patch("/appointments/:id", async (req, res) => {
  const paramsParsed = UpdateAppointmentParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const bodyParsed = UpdateAppointmentBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const [updated] = await db
    .update(appointmentsTable)
    .set(bodyParsed.data)
    .where(eq(appointmentsTable.id, paramsParsed.data.id))
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

router.delete("/appointments/:id", async (req, res) => {
  const parsed = DeleteAppointmentParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  await db
    .delete(appointmentsTable)
    .where(eq(appointmentsTable.id, parsed.data.id));

  res.status(204).send();
});

export default router;
