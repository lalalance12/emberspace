import type { Metadata } from "next";
import Link from "next/link";

import { TimelineDatePicker } from "./date-picker";
import { TimelineView, type TimelineRow } from "./timeline-view";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { getViewer } from "@/lib/queries";
import { withUser } from "@/lib/db";

export const metadata: Metadata = { title: "Timeline" };

/**
 * One day of history, chosen by ?date=YYYY-MM-DD.
 *
 * The day lives in the URL rather than in client state so it survives a reload
 * and can be linked to — "here is what Tuesday looked like" is a thing people
 * say. The query stays bounded to a single day for the same reason the board
 * is: this is a glance, not an archive.
 *
 * Everything finer than the day — who, which state, which hours — is filtered
 * client-side, because a day of one team's statuses is a few dozen rows and a
 * round trip per checkbox would lose the instant feel.
 */
function parseDay(input: string | undefined): Date {
  const day = new Date();
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split("-").map(Number);
    const parsed = new Date(y, m - 1, d);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return day;
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer?.profile.team_id) return null;

  const { date } = await searchParams;
  const day = parseDay(date);

  const from = new Date(day);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);

  const teamId = viewer.profile.team_id;
  const { rows, members } = await withUser(viewer.profile.id, async (db) => {
    const [history, roster] = await Promise.all([
      db.query<TimelineRow>(
        `select id, profile_id, state, note, ticket_ref, duration_minutes, custom_label, details, started_at
           from public.status_updates
          where team_id = $1 and started_at >= $2 and started_at < $3
          order by started_at desc`,
        [teamId, from.toISOString(), to.toISOString()],
      ),
      db.query<{ id: string; display_name: string }>(
        "select id, display_name from public.profiles where team_id = $1 order by display_name",
        [teamId],
      ),
    ]);
    return { rows: history.rows, members: roster.rows };
  });

  const count = rows?.length ?? 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = from.getTime() === today.getTime();

  return (
    <>
      <PageHeader
        eyebrow="The story of the day"
        title="Timeline"
        description="Catch up on how work moved, one update at a time."
        action={<TimelineDatePicker selected={isoDay(from)} isToday={isToday} />}
      />

      {count === 0 ? (
        <EmptyState
          title={isToday ? "Nothing posted today yet" : "Nothing posted that day"}
          hint={isToday ? "Your team's updates will collect here as the day unfolds." : "Choose another day to see what your team was working on."}
          action={
            isToday ? (
              <Link href="/me" className="btn btn-primary">
                Post the first update
              </Link>
            ) : undefined
          }
        />
      ) : (
        <TimelineView
          rows={(rows ?? []) as TimelineRow[]}
          people={members ?? []}
          serverNow={Date.now()}
        />
      )}
    </>
  );
}
