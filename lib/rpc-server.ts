import "server-only";

import type { PoolClient } from "pg";

import { withUser } from "@/lib/db";
import { CALLABLE_RPCS, type CallableRpc, type Client, type PostgrestLike } from "@/lib/rpc";

/**
 * Call one write-API function as the signed-in user.
 *
 * The name comes from a fixed list and every argument name must look like the
 * migrations' own (`p_something`), so nothing a caller sends is ever spliced
 * into SQL — only the values, and those as bind parameters. Absent arguments
 * are left out entirely so Postgres applies the function's own defaults, the
 * same contract PostgREST had.
 */
export async function runRpc(db: PoolClient, name: string, args: Record<string, unknown> = {}) {
  if (!(CALLABLE_RPCS as readonly string[]).includes(name)) {
    throw Object.assign(new Error(`${name} is not part of the write API.`), { code: "42883" });
  }

  const entries = Object.entries(args).filter(([, value]) => value !== undefined);
  for (const [key] of entries) {
    if (!/^p_[a-z_]+$/.test(key)) {
      throw Object.assign(new Error(`Unexpected argument ${key}.`), { code: "42883" });
    }
  }

  const params = entries.map(([key], i) => `${key} => $${i + 1}`).join(", ");
  const { rows } = await db.query(`select * from public.${name}(${params})`, entries.map(([, v]) => v));

  // A function returning a row type comes back as that row. One returning a
  // scalar (or void) comes back as a single column named after the function.
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const keys = Object.keys(row);
  return keys.length === 1 && keys[0] === name ? row[name] ?? null : row;
}

/** Postgres errors already carry .code (the SQLSTATE) and .message. */
export function toPostgrestLike(error: unknown): PostgrestLike {
  if (error && typeof error === "object") {
    const e = error as { code?: unknown; message?: unknown; detail?: unknown };
    return {
      code: typeof e.code === "string" ? e.code : undefined,
      message: typeof e.message === "string" ? e.message : "That didn't go through. Try again.",
      details: typeof e.detail === "string" ? e.detail : null,
    };
  }
  return { message: String(error) };
}

/** A Client for server code that already knows who the user is. */
export function serverClient(userId: string): Client {
  return {
    async rpc(name: CallableRpc, args?: Record<string, unknown>) {
      try {
        const data = await withUser(userId, (db) => runRpc(db, name, args));
        return { data, error: null };
      } catch (error) {
        return { data: null, error: toPostgrestLike(error) };
      }
    },
    async markNotificationRead(id: string) {
      try {
        await withUser(userId, (db) =>
          db.query("update public.notifications set read_at = now() where id = $1", [id]),
        );
        return { error: null };
      } catch (error) {
        return { error: toPostgrestLike(error) };
      }
    },
  } as Client;
}
