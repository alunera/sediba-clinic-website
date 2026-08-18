import app from "./app";
import { logger } from "./lib/logger";
import { runSchemaMigrations } from "./lib/migrations";
import { rehydrateReminders } from "./lib/whatsapp";
import { releaseExpiredPendingBookings } from "./routes/payments";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Apply idempotent schema migrations before accepting traffic so that both
// dev and production environments always have the latest columns.
runSchemaMigrations()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");

      // Re-queue any reminders that were pending when the server last stopped.
      void rehydrateReminders();

      // Periodically release slots held by abandoned unpaid bookings.
      setInterval(() => {
        releaseExpiredPendingBookings().catch((err) =>
          logger.error({ err }, "[Payments] Expiry sweep failed")
        );
      }, 60_000);
    });
  })
  .catch((err) => {
    logger.error({ err }, "Startup migration failed — refusing to start");
    process.exit(1);
  });
