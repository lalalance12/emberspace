import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/ui/page";
import { getBoardData, getViewer } from "@/lib/queries";

export const metadata: Metadata = { title: "Office" };

/**
 * Floor-plan view with speech bubbles.
 *
 * Parked until after the presentation, and deliberately not deleted: it reads
 * the real roster, so whatever gets drawn here starts from true data. The route
 * stays reachable by URL; it is only off the nav, because a tab that leads to
 * "not built yet" spends a click to deliver a disappointment.
 */
export default async function OfficePage() {
  const viewer = await getViewer();
  if (!viewer?.profile.team_id) return null;

  const { members } = await getBoardData(viewer.profile.team_id);

  return (
    <>
      <PageHeader eyebrow="A place for everyone" title="Office" description="A shared space to see your team together." />

      <section className="office-preview">
        <div className="office-floorplan" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => <span key={i} className="office-desk"><i /><b /></span>)}
          <div className="office-floorplan-label">Your team&apos;s space</div>
        </div>
        <div className="office-preview-content">
          <span className="office-coming-soon">Coming soon</span>
          <h2>A little closer, wherever you work.</h2>
          <p>The office view is taking shape. For now, find all {members.length} teammate{members.length === 1 ? "" : "s"} and their latest updates on the board.</p>
          <Link href="/board" className="btn btn-primary">Go to team board <span aria-hidden="true">→</span></Link>
        </div>
      </section>
    </>
  );
}
