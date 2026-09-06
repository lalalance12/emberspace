import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BoardView } from "./board-view";
import { PageHeader } from "@/components/ui/page";
import { getBoardData, getOpenPeerNudges, getViewer } from "@/lib/queries";

export const metadata: Metadata = { title: "Board" };

/**
 * Server shell: fetch the initial data for a fast first paint, then hand off
 * to a client component that subscribes to Realtime and patches it.
 */
export default async function BoardPage() {
  const viewer = await getViewer();
  if (!viewer) return null;

  // The layout already sent teamless viewers to /onboarding; this repeats the
  // check only to narrow the type.
  if (!viewer.profile.team_id) redirect("/onboarding");

  const [{ members, statuses }, nudges] = await Promise.all([
    getBoardData(viewer.profile.team_id),
    getOpenPeerNudges(viewer.profile.team_id),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Your team, at a glance"
        title="Team board"
        description="See what's moving, who's focused, and where a little help could go a long way."
        action={
          <Link href="/me" className="btn btn-primary">
            <span aria-hidden="true">+</span> Post update
          </Link>
        }
      />

      <BoardView
        teamId={viewer.profile.team_id}
        viewerId={viewer.profile.id}
        members={members}
        initialStatuses={statuses}
        initialNudges={nudges}
        serverNow={Date.now()}
      />
    </>
  );
}
