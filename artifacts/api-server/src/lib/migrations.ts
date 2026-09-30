/**
 * Lightweight startup migrations.
 *
 * Runs idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS` statements so that
 * any environment (dev or production) automatically gains new columns on the
 * next server boot — no manual `drizzle-kit push` step required.
 *
 * Keep this file append-only: add new statements at the bottom; never remove
 * or reorder existing ones.
 */

import { pool } from "@workspace/db";
import { logger } from "./logger";
import { reconcileServiceCatalog } from "./service-catalog";
import { matchingClientId } from "./client-records";

const MIGRATIONS = [
  // Task: persist appointment reminders across server restarts
  `ALTER TABLE appointments
     ADD COLUMN IF NOT EXISTS reminder_scheduled_for TIMESTAMPTZ,
     ADD COLUMN IF NOT EXISTS reminder_sent_at       TIMESTAMPTZ`,
  // Task: admin-managed appointment availability
  `CREATE TABLE IF NOT EXISTS availability_slots (
     id SERIAL PRIMARY KEY,
     date DATE NOT NULL,
     time TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS availability_slots_date_time_uq
     ON availability_slots (date, time)`,
  // Phase 2C: payment tracking for 100% deposit bookings
  `CREATE TABLE IF NOT EXISTS payments (
     id SERIAL PRIMARY KEY,
     appointment_id INTEGER NOT NULL REFERENCES appointments(id),
     booking_ref TEXT NOT NULL,
     m_payment_id TEXT NOT NULL,
     pf_payment_id TEXT,
     amount_cents INTEGER NOT NULL,
     provider TEXT NOT NULL DEFAULT 'yoco',
     status TEXT NOT NULL DEFAULT 'created',
     raw_itn TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS payments_m_payment_id_uq
     ON payments (m_payment_id)`,
  `ALTER TABLE payments
     ADD COLUMN IF NOT EXISTS provider_checkout_id TEXT,
     ADD COLUMN IF NOT EXISTS webhook_event_id TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS payments_webhook_event_id_uq
     ON payments (webhook_event_id) WHERE webhook_event_id IS NOT NULL`,
  // The dedicated consultation flow requires a service record in every environment.
  `INSERT INTO services (name, category, description, duration, price_cents)
     SELECT
       'Consultation',
       'consultation',
       'A personalised consultation to assess your skin, understand your concerns and goals, and create a treatment plan designed around you.',
       30,
       35000
     WHERE NOT EXISTS (
       SELECT 1 FROM services WHERE lower(category) = 'consultation'
     )`,
  `CREATE TABLE IF NOT EXISTS client_records (
     id SERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     email TEXT,
     phone TEXT,
     whatsapp TEXT,
     date_of_birth DATE,
     internal_notes TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_record_id INTEGER REFERENCES client_records(id)`,
  `CREATE INDEX IF NOT EXISTS appointments_client_record_id_idx ON appointments (client_record_id)`,
];

// Guarantee at the database level that two non-cancelled appointments can
// never occupy the same date+time (prevents double booking under races).
// Created separately: if historical data already contains duplicate active
// appointments, index creation fails — in that case we log loudly and keep
// the server running (POST-time validation still guards new bookings) rather
// than blocking startup. An operator must resolve the duplicates manually.
const ACTIVE_SLOT_INDEX = `CREATE UNIQUE INDEX IF NOT EXISTS appointments_active_slot_uq
   ON appointments (date, time) WHERE status <> 'cancelled'`;

/**
 * Apply all pending schema migrations.
 * Safe to call on every startup — each statement uses `IF NOT EXISTS`.
 */
export async function runSchemaMigrations(): Promise<void> {
  logger.info("[Migrations] Running startup schema migrations…");
  const client = await pool.connect();
  try {
    for (const sql of MIGRATIONS) {
      await client.query(sql);
    }
    // Backfill snapshots conservatively; leave invalid contact rows unlinked.
    // A dedicated transaction makes each run atomic and serializes with new bookings.
    await client.query("BEGIN");
    try {
      await client.query("SELECT pg_advisory_xact_lock(83412091)");
      const { rows: profiles } = await client.query<{
        id: number; name: string; email: string | null; phone: string | null; whatsapp: string | null;
      }>("SELECT id, name, email, phone, whatsapp FROM client_records");
      const { rows: bookings } = await client.query<{
        id: number; name: string; email: string | null; phone: string | null; whatsapp: string | null;
      }>(`SELECT id, client_name AS name, client_email AS email, client_phone AS phone,
            client_whatsapp AS whatsapp FROM appointments WHERE client_record_id IS NULL ORDER BY id`);
      for (const booking of bookings) {
        if (!booking.name?.trim() || !booking.email?.trim() && !booking.phone?.trim() && !booking.whatsapp?.trim()) continue;
        let id = matchingClientId(booking, profiles);
        if (!id) {
          const inserted = await client.query<{ id: number }>(
            `INSERT INTO client_records (name, email, phone, whatsapp) VALUES ($1, $2, $3, $4) RETURNING id`,
            [booking.name.trim(), booking.email?.trim() || null, booking.phone?.trim() || null, booking.whatsapp?.trim() || null],
          );
          id = inserted.rows[0]!.id;
          profiles.push({ id, name: booking.name.trim(), email: booking.email, phone: booking.phone, whatsapp: booking.whatsapp });
        }
        await client.query("UPDATE appointments SET client_record_id = $1 WHERE id = $2 AND client_record_id IS NULL", [id, booking.id]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
    const catalogPlan = await reconcileServiceCatalog(client);
    logger.info(
      {
        inserted: catalogPlan.inserts.length,
        updated: catalogPlan.updates.length,
      },
      "[Migrations] Public service catalog reconciled",
    );
    try {
      await client.query(ACTIVE_SLOT_INDEX);
    } catch (err) {
      logger.error(
        { err },
        "[Migrations] Could not create appointments_active_slot_uq — the appointments table " +
          "likely contains duplicate non-cancelled appointments on the same date+time. " +
          "Double-booking protection is running in validation-only mode until an operator " +
          "resolves the duplicates (cancel one of each pair) and restarts the server."
      );
    }
    logger.info("[Migrations] Schema is up to date");
  } catch (err) {
    logger.error({ err }, "[Migrations] Migration failed");
    throw err; // prevent server from starting with a broken schema
  } finally {
    client.release();
  }
}
