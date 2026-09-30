import { Router } from "express";
import { db, appointmentsTable, clientRecordsTable, servicesTable } from "@workspace/db";
import { eq, ilike, or, desc } from "drizzle-orm";
import {
  ListAdminClientRecordsQueryParams, ListAdminClientRecordsResponse,
  CreateAdminClientRecordBody, UpdateAdminClientRecordBody,
  GetAdminClientRecordParams, UpdateAdminClientRecordParams,
  GetAdminClientRecordResponse, UpdateAdminClientRecordResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/admin-auth";
import { cleanClientFields, validateClientFields } from "../lib/client-records";

const router = Router();
router.use("/admin/client-records", requireAdmin);

type RecordRow = typeof clientRecordsTable.$inferSelect;
const present = (row: RecordRow) => ({
  id: row.id, name: row.name, email: row.email, phone: row.phone,
  whatsapp: row.whatsapp, dateOfBirth: row.dateOfBirth, internalNotes: row.internalNotes,
  createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
});

router.get("/admin/client-records", async (req, res): Promise<void> => {
  const query = ListAdminClientRecordsQueryParams.safeParse(req.query);
  if (!query.success || (req.query.search !== undefined && typeof req.query.search !== "string")) {
    res.status(400).json({ error: "Invalid search" }); return;
  }
  const search = query.data.search?.trim();
  const escaped = search?.replace(/[\\%_]/g, "\\$&");
  const rows = await db.select().from(clientRecordsTable)
    .where(escaped ? or(
      ilike(clientRecordsTable.name, `%${escaped}%`),
      ilike(clientRecordsTable.email, `%${escaped}%`),
      ilike(clientRecordsTable.phone, `%${escaped}%`),
      ilike(clientRecordsTable.whatsapp, `%${escaped}%`),
    ) : undefined).orderBy(desc(clientRecordsTable.createdAt), desc(clientRecordsTable.id));
  res.json(ListAdminClientRecordsResponse.parse(rows.map(present)));
});

router.post("/admin/client-records", async (req, res): Promise<void> => {
  const parsed = CreateAdminClientRecordBody.safeParse(req.body);
  const error = parsed.success ? validateClientFields(req.body, true) : parsed.error.message;
  if (error) { res.status(400).json({ error }); return; }
  const fields = cleanClientFields(parsed.data as Record<string, unknown>);
  const [row] = await db.insert(clientRecordsTable).values({
    name: fields.name!, email: fields.email ?? null, phone: fields.phone ?? null,
    whatsapp: fields.whatsapp ?? null, dateOfBirth: fields.dateOfBirth ?? null,
    internalNotes: fields.internalNotes ?? null,
  }).returning();
  res.status(201).json(UpdateAdminClientRecordResponse.parse(present(row!)));
});

router.get("/admin/client-records/:id", async (req, res): Promise<void> => {
  const params = GetAdminClientRecordParams.safeParse(req.params);
  if (!params.success || !Number.isSafeInteger(params.data.id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [row] = await db.select().from(clientRecordsTable).where(eq(clientRecordsTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Client not found" }); return; }
  const bookings = await db.select({
    id: appointmentsTable.id, bookingRef: appointmentsTable.bookingRef,
    clientName: appointmentsTable.clientName, clientEmail: appointmentsTable.clientEmail,
    clientPhone: appointmentsTable.clientPhone, clientWhatsapp: appointmentsTable.clientWhatsapp,
    serviceName: servicesTable.name, date: appointmentsTable.date, time: appointmentsTable.time,
    status: appointmentsTable.status, createdAt: appointmentsTable.createdAt,
  }).from(appointmentsTable).leftJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
    .where(eq(appointmentsTable.clientRecordId, row.id))
    .orderBy(desc(appointmentsTable.date), desc(appointmentsTable.id));
  res.json(GetAdminClientRecordResponse.parse({
    ...present(row), bookings: bookings.map((booking) => ({ ...booking, createdAt: booking.createdAt.toISOString() })),
  }));
});

router.patch("/admin/client-records/:id", async (req, res): Promise<void> => {
  const params = UpdateAdminClientRecordParams.safeParse(req.params);
  if (!params.success || !Number.isSafeInteger(params.data.id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const parsed = UpdateAdminClientRecordBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) { res.status(400).json({ error: "Invalid body" }); return; }
  const [current] = await db.select().from(clientRecordsTable).where(eq(clientRecordsTable.id, params.data.id));
  if (!current) { res.status(404).json({ error: "Client not found" }); return; }
  const update = cleanClientFields(req.body as Record<string, unknown>);
  const merged = Object.fromEntries(["name", "email", "phone", "whatsapp", "dateOfBirth", "internalNotes"]
    .map((key) => [key, key in update ? update[key] : current[key as keyof RecordRow]]));
  const error = validateClientFields(req.body, false) || validateClientFields(merged, true);
  if (error) { res.status(400).json({ error }); return; }
  const [row] = await db.update(clientRecordsTable).set({ ...update, updatedAt: new Date() })
    .where(eq(clientRecordsTable.id, current.id)).returning();
  res.json(UpdateAdminClientRecordResponse.parse(present(row!)));
});

export default router;