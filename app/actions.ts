"use server";

import { withUser } from "@/lib/db";
import { getSessionUser } from "@/lib/queries";
import type { PostgrestLike } from "@/lib/rpc";
import { runRpc, toPostgrestLike } from "@/lib/rpc-server";

/**
 * The browser's only way into the database. Each action resolves the session
 * itself — nothing here trusts an id sent from the page — and runs as that user
 * under RLS. Results come back as { data, error } rather than thrown, because a
 * server action's thrown error is redacted in production and the SQLSTATE is
 * exactly what lib/rpc.ts needs to say what went wrong.
 */

const SIGNED_OUT: PostgrestLike = { code: "28000", message: "You're signed out. Sign in again and retry." };

async function asSignedIn<T>(fn: (userId: string) => Promise<T>): Promise<{ data: T | null; error: PostgrestLike | null }> {
  const user = await getSessionUser();
  if (!user) return { data: null, error: SIGNED_OUT };
  try {
    return { data: await fn(user.id), error: null };
  } catch (error) {
    return { data: null, error: toPostgrestLike(error) };
  }
}

/** One write-API function, by name. The list it accepts lives in lib/rpc.ts. */
export async function callRpc(name: string, args?: Record<string, unknown>) {
  return asSignedIn((userId) => withUser(userId, (db) => runRpc(db, name, args)));
}

/** The one write the client may make to notifications. RLS limits it to your own. */
export async function markNotificationReadAction(id: string) {
  const { error } = await asSignedIn((userId) =>
    withUser(userId, (db) => db.query("update public.notifications set read_at = now() where id = $1", [id])),
  );
  return { error };
}

export interface ProfileSettings {
  display_name: string;
  message_link: string | null;
  peer_nudges_enabled: boolean;
  system_nudges_enabled: boolean;
}

/** /settings/me. Role and team are refused by a trigger even if someone tried. */
export async function updateMyProfile(values: ProfileSettings) {
  const { error } = await asSignedIn((userId) =>
    withUser(userId, (db) =>
      db.query(
        `update public.profiles
            set display_name = $2, message_link = $3, peer_nudges_enabled = $4, system_nudges_enabled = $5
          where id = $1`,
        [userId, values.display_name, values.message_link, values.peer_nudges_enabled, values.system_nudges_enabled],
      ),
    ),
  );
  return { error };
}

export interface TeamPolicySettings {
  name: string;
  system_nudges_enabled: boolean;
  stale_after_minutes: number;
  renudge_after_minutes: number;
  peer_nudges_per_hour: number;
  peer_nudges_per_recipient_per_hour: number;
}

/**
 * /settings/team. The "head updates own team" policy is what limits this to
 * the head; a member's update simply matches no row.
 */
export async function updateTeamPolicy(teamId: string, values: TeamPolicySettings) {
  const { error } = await asSignedIn((userId) =>
    withUser(userId, async (db) => {
      const { rowCount } = await db.query(
        `update public.teams
            set name = $2, system_nudges_enabled = $3, stale_after_minutes = $4, renudge_after_minutes = $5,
                peer_nudges_per_hour = $6, peer_nudges_per_recipient_per_hour = $7
          where id = $1`,
        [
          teamId,
          values.name,
          values.system_nudges_enabled,
          values.stale_after_minutes,
          values.renudge_after_minutes,
          values.peer_nudges_per_hour,
          values.peer_nudges_per_recipient_per_hour,
        ],
      );
      if (rowCount === 0) {
        throw Object.assign(new Error("Only the team head can change these settings."), { code: "42501" });
      }
    }),
  );
  return { error };
}
