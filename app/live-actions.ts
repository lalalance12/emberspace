"use server";

import { withUser } from "@/lib/db";
import { BOARD_STATUS_COLUMNS, PEER_NUDGE_COLUMNS, getSessionUser, type BoardStatus } from "@/lib/queries";
import { runDueJobs } from "@/lib/scheduler";

/**
 * What used to arrive over Realtime, now fetched on a short poll.
 *
 * One call returns the whole live picture for a board — current statuses, open
 * peer nudges, who is here — rather than a stream of changes. A team is a
 * handful of rows, so sending the snapshot is cheaper and simpler than diffing
 * on the server, and the client can never drift out of sync with a missed
 * event.
 */

/** Someone is "here" while their last poll is this recent. Polls run every 5s. */
const ONLINE_WINDOW_SECONDS = 45;

export interface BoardSnapshot {
  statuses: BoardStatus[];
  nudges: Array<{ id: string; recipient_id: string; sender_id: string | null; note: string | null; link: string | null; created_at: string }>;
  online: string[];
}

export async function getBoardSnapshot(teamId: string): Promise<BoardSnapshot | null> {
  const user = await getSessionUser();
  if (!user) return null;

  // Stale-status nudges and timed switches used to be pg_cron's job.
  await runDueJobs();

  return withUser(user.id, async (db) => {
    // "I'm still here" first, so the viewer counts themselves as online.
    await db.query("select public.mark_seen()");

    const [statuses, nudges, online] = await Promise.all([
      db.query<BoardStatus>(
        `select ${BOARD_STATUS_COLUMNS} from public.status_updates where team_id = $1 and ended_at is null`,
        [teamId],
      ),
      db.query<BoardSnapshot["nudges"][number]>(
        `select ${PEER_NUDGE_COLUMNS} from public.nudges
          where team_id = $1 and kind = 'peer' and state = 'open' order by created_at desc`,
        [teamId],
      ),
      db.query<{ profile_id: string }>(
        `select profile_id from public.presence
          where team_id = $1 and seen_at > now() - make_interval(secs => $2)`,
        [teamId, ONLINE_WINDOW_SECONDS],
      ),
    ]);

    return {
      statuses: statuses.rows,
      nudges: nudges.rows,
      online: online.rows.map((r) => r.profile_id),
    };
  });
}

export interface NotificationRow {
  id: string;
  kind: string;
  nudge_id: string | null;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
}

/** The bell's feed: the latest twenty, newest first. RLS limits it to your own. */
export async function getNotifications(): Promise<NotificationRow[] | null> {
  const user = await getSessionUser();
  if (!user) return null;

  return withUser(user.id, async (db) => {
    const { rows } = await db.query<NotificationRow>(
      `select id, kind, nudge_id, title, body, href, read_at, created_at
         from public.notifications order by created_at desc limit 20`,
    );
    return rows;
  });
}
