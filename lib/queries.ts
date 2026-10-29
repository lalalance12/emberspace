import "server-only";

import { cache } from "react";
import { headers } from "next/headers";

import { getSessionCookie } from "better-auth/cookies";

import { auth } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import { withUser } from "@/lib/db";

/**
 * Server-side reads for initial paint. Client components take it from here and
 * keep it fresh by polling (lib/live.ts).
 *
 * Everything runs as the signed-in user under RLS, through withUser(). If
 * something comes back empty that shouldn't, the fix is a policy in
 * db/migrations/20260805090300_rls.sql — never a query that skips withUser().
 */

type Tables = Database["public"]["Tables"];
export type Profile = Tables["profiles"]["Row"];

/**
 * The signed-in user from the session cookie, or null. One lookup per request.
 *
 * No cookie, no query: an anonymous visitor to the landing page never touches
 * the database, so it can stay asleep.
 */
export const getSessionUser = cache(async () => {
  const requestHeaders = await headers();
  if (!getSessionCookie(requestHeaders)) return null;
  const session = await auth.api.getSession({ headers: requestHeaders });
  return session?.user ?? null;
});

export async function getViewer() {
  const user = await getSessionUser();
  if (!user) return null;

  try {
    const profile = await withUser(user.id, async (db) => {
      const { rows } = await db.query<Profile>("select * from public.profiles where id = $1", [user.id]);
      return rows[0] ?? null;
    });
    if (!profile) return null;
    return { user, profile };
  } catch (error) {
    // Swallowing this is how a missing GRANT turns into an infinite
    // /board -> /login -> /board redirect instead of a legible failure. Say
    // which of the two very different causes it is: "fix the policy" is
    // useless advice when the table itself was never created.
    const message = error instanceof Error ? error.message : String(error);
    const missingTable = /relation .* does not exist/i.test(message);
    throw new Error(
      missingTable
        ? `Could not read your profile: ${message}. This database has no schema yet — run "pnpm db:migrate".`
        : `Could not read your profile: ${message}. This is a policy or privilege problem in db/migrations, not a client bug.`,
    );
  }
}

/** Current status per teammate, plus the roster to render them against. */
export async function getBoardData(userId: string, teamId: string) {
  return withUser(userId, async (db) => {
    const [members, statuses] = await Promise.all([
      // peer_nudges_enabled and the pause drive whether the board offers a
      // Nudge button at all. The RPC refuses either way; asking first means we
      // do not offer an action that is guaranteed to fail.
      db.query<Pick<Profile, "id" | "display_name" | "avatar_url" | "message_link" | "peer_nudges_enabled" | "nudges_paused_until">>(
        `select id, display_name, avatar_url, message_link, peer_nudges_enabled, nudges_paused_until
           from public.profiles where team_id = $1 order by display_name`,
        [teamId],
      ),
      // details comes down with the board rather than on demand: it is capped
      // at 2000 characters and a team is a handful of rows, so one round trip
      // beats a fetch per card the moment anyone opens a preview.
      db.query<BoardStatus>(
        `select ${BOARD_STATUS_COLUMNS} from public.status_updates where team_id = $1 and ended_at is null`,
        [teamId],
      ),
    ]);
    return { members: members.rows, statuses: statuses.rows };
  });
}

export const BOARD_STATUS_COLUMNS =
  "id, profile_id, state, note, ticket_ref, duration_minutes, custom_label, details, auto_switch_to, started_at";

export type BoardStatus = Pick<
  Tables["status_updates"]["Row"],
  "id" | "profile_id" | "state" | "note" | "ticket_ref" | "duration_minutes" | "custom_label" | "details" | "auto_switch_to" | "started_at"
>;

/** Your own current status, for /me. */
export async function getMyStatus(profileId: string) {
  return withUser(profileId, async (db) => {
    const { rows } = await db.query<BoardStatus>(
      `select ${BOARD_STATUS_COLUMNS} from public.status_updates where profile_id = $1 and ended_at is null`,
      [profileId],
    );
    return rows[0] ?? null;
  });
}

/** Recent quick picks, most recently used first. */
export async function getQuickPicks(profileId: string) {
  return withUser(profileId, async (db) => {
    const { rows } = await db.query<Pick<Tables["quick_picks"]["Row"], "id" | "state" | "note" | "ticket_ref" | "last_used_at">>(
      `select id, state, note, ticket_ref, last_used_at from public.quick_picks
        where profile_id = $1 order by last_used_at desc limit 6`,
      [profileId],
    );
    return rows;
  });
}

export const PEER_NUDGE_COLUMNS = "id, recipient_id, sender_id, note, link, created_at";

/**
 * Open peer nudges for the team.
 *
 * Peer nudges are readable team-wide by policy, on purpose: nudging in the open
 * keeps it social, and a covert nudge is a management cudgel. The board uses
 * this both to mark who has been nudged and to show the recipient their own.
 */
export async function getOpenPeerNudges(userId: string, teamId: string) {
  return withUser(userId, async (db) => {
    const { rows } = await db.query<Pick<Tables["nudges"]["Row"], "id" | "recipient_id" | "sender_id" | "note" | "link" | "created_at">>(
      `select ${PEER_NUDGE_COLUMNS} from public.nudges
        where team_id = $1 and kind = 'peer' and state = 'open' order by created_at desc`,
      [teamId],
    );
    return rows;
  });
}
