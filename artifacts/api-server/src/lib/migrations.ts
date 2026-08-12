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
];

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
    logger.info("[Migrations] Schema is up to date");
  } catch (err) {
    logger.error({ err }, "[Migrations] Migration failed");
    throw err; // prevent server from starting with a broken schema
  } finally {
    client.release();
  }
}
