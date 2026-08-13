import { pgTable, text, serial, integer, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const servicesTable = pgTable("services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  duration: integer("duration").notNull(),
  price: integer("price_cents").notNull(),
  imageUrl: text("image_url"),
});

export const appointmentsTable = pgTable("appointments", {
  id: serial("id").primaryKey(),
  bookingRef: text("booking_ref").notNull().unique(),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email").notNull(),
  clientPhone: text("client_phone").notNull(),
  clientWhatsapp: text("client_whatsapp"),
  serviceId: integer("service_id").notNull().references(() => servicesTable.id),
  date: date("date", { mode: "string" }).notNull(),
  time: text("time").notNull(),
  totalAmountCents: integer("total_amount_cents").notNull().default(0),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  policyAgreed: text("policy_agreed").notNull().default("false"),
  appointmentType: text("appointment_type").notNull().default("treatment"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  /** When the 24-hour reminder is due to be sent (null = no reminder needed). */
  reminderScheduledFor: timestamp("reminder_scheduled_for", { withTimezone: true }),
  /** When the 24-hour reminder was actually sent (null = not yet sent). */
  reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
});

/**
 * Bookable time slots configured by the clinic admin. A calendar date is
 * available to customers iff it has at least one slot not taken by a
 * non-cancelled appointment. No rows for a date = date unavailable.
 */
export const availabilitySlotsTable = pgTable(
  "availability_slots",
  {
    id: serial("id").primaryKey(),
    date: date("date", { mode: "string" }).notNull(),
    time: text("time").notNull(), // "HH:MM", 24h, Africa/Johannesburg
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("availability_slots_date_time_uq").on(t.date, t.time)]
);

export const insertServiceSchema = createInsertSchema(servicesTable).omit({ id: true });
export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({ id: true, createdAt: true });

export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof servicesTable.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointmentsTable.$inferSelect;
