import "server-only";

import { attachDatabasePool } from "@vercel/functions";
import pg, { type PoolClient } from "pg";

/**
 * The one connection to Postgres (Neon). Server-only: the browser never holds
 * a database credential, and reaches data only through server actions and
 * server components that call into here.
 *
 * Every user-facing query runs inside withUser(), which steps down from the
 * owner connection into the `authenticated` role with the signed-in user's id
 * set for auth.uid(). RLS is the enforcement, exactly as it was on Supabase —
 * if a query comes back empty, the fix is a policy in db/migrations, never a
 * query that skips withUser().
 */

// Timestamps reach the app as ISO strings, the shape Supabase delivered and
// every component already expects. pg's own parser handles Postgres's offset
// format; this only re-serialises the result.
const parseTimestamptz = pg.types.getTypeParser(pg.types.builtins.TIMESTAMPTZ);
const parseTimestamp = pg.types.getTypeParser(pg.types.builtins.TIMESTAMP);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (v) => (parseTimestamptz(v) as Date).toISOString());
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (v) => (parseTimestamp(v) as Date).toISOString());

const connectionString = process.env.DATABASE_URL;

/** Fails at the first query rather than at import, so public pages still render. */
function assertConfigured() {
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add Neon to the Vercel project (Storage → Neon), " +
        "then run `vercel env pull .env.local`.",
    );
  }
}

const globalForPool = globalThis as unknown as { workspacePool?: pg.Pool };

/** Reused across hot reloads in dev, and across invocations on Fluid compute. */
export const pool =
  globalForPool.workspacePool ??
  new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 10_000 });

if (!globalForPool.workspacePool) {
  globalForPool.workspacePool = pool;
  attachDatabasePool(pool);
}

/**
 * Run `fn` as the signed-in user, under RLS, in one transaction.
 *
 * Both settings are transaction-local (`set_config(..., true)` and
 * `set local role`), so the pooled connection goes back to the pool as the
 * owner with no identity attached.
 */
export async function withUser<T>(userId: string, fn: (db: PoolClient) => Promise<T>): Promise<T> {
  assertConfigured();
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await client.query("set local role authenticated");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Run `fn` as the database owner. For the scheduler functions only
 * (enqueue_due_nudges, expire_due_durations), which are revoked from every
 * client role on purpose and act on the whole database, not on one user.
 * Never use this to read or write on a user's behalf.
 */
export async function asOwner<T>(fn: (db: PoolClient) => Promise<T>): Promise<T> {
  assertConfigured();
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
