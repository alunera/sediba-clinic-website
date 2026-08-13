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
