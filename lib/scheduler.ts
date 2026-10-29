import "server-only";

import { asOwner } from "@/lib/db";

/**
 * The two jobs pg_cron used to run every minute, now run by the app.
 *
 *   enqueue_due_nudges()   — "Still on the checkout bug?" for stale statuses
 *   expire_due_durations() — switch a timed status to its follow-up state
 *
 * Neon sleeps when idle and pg_cron only runs while it is awake, so the
 * schedule lives here instead: every board poll calls runDueJobs(), and this
 * lets one through per minute per server instance. Both functions are
 * idempotent and guard against double work themselves (the no-double-nudge
 * guard is in SQL, and tested there), so two instances racing is harmless.
 *
 * They run as the owner because they are revoked from every client role on
 * purpose: they act on the whole database, not on one user's behalf.
 */
const INTERVAL_MS = 60_000;
let lastRun = 0;

export async function runDueJobs() {
  const now = Date.now();
  if (now - lastRun < INTERVAL_MS) return;
  lastRun = now;

  try {
    await asOwner(async (db) => {
      await db.query("select public.expire_due_durations()");
      await db.query("select public.enqueue_due_nudges()");
    });
  } catch (error) {
    // A failed run must not break the board poll that triggered it. The next
    // minute tries again.
    lastRun = 0;
    console.error("Scheduled jobs failed:", error);
  }
}
