import type { Metadata } from "next";

import { TeamMembershipForm } from "./team-membership-form";
import { TeamPolicyForm, type TeamPolicy } from "./team-policy-form";
import { PageHeader, Panel } from "@/components/ui/page";
import { SettingsNav } from "@/components/settings-nav";
import { getViewer } from "@/lib/queries";
import { withUser } from "@/lib/db";

/** Static, though the h1 is the team name: titles that move are hard to find. */
export const metadata: Metadata = { title: "Team settings" };

/**
 * Two halves with different audiences.
 *
 * The membership half — which team you are on, how to leave it, how to move to
 * another — belongs to everyone standing on the team. The policy half, the join
 * code and every nudge limit, stays with the head.
 *
 * This page used to redirect anyone who was not the head straight to /board,
 * which is why members had no way out of a team at all. The gate moved from the
 * route to the panel.
 */
export default async function TeamSettingsPage() {
  const viewer = await getViewer();
  if (!viewer) return null;

  const isHead = viewer.profile.role === "head";
  const teamId = viewer.profile.team_id ?? "";
  const { team, roster } = await withUser(viewer.profile.id, async (db) => {
    const [teams, people] = await Promise.all([
      db.query<TeamPolicy>(
        `select id, name, join_code, stale_after_minutes, renudge_after_minutes, system_nudges_enabled,
                peer_nudges_per_hour, peer_nudges_per_recipient_per_hour
           from public.teams where id = $1`,
        [teamId],
      ),
      // Ordered the way release_team_membership() orders it, so the successor
      // named in the confirmation is the one the database will actually promote.
      // created_at then id — the same tiebreak, for the same reason.
      db.query<{ id: string; display_name: string; created_at: string }>(
        "select id, display_name, created_at from public.profiles where team_id = $1 order by created_at, id",
        [teamId],
      ),
    ]);
    return { team: teams.rows[0] ?? null, roster: people.rows };
  });

  if (!team) {
    return (
      <Panel className="mx-auto mt-10 max-w-md p-8 text-center">
        <p className="text-lg font-medium">No team yet.</p>
      </Panel>
    );
  }

  const members = roster ?? [];
  const successor = members.find((m) => m.id !== viewer.profile.id) ?? null;

  return (
    <>
      <PageHeader
        eyebrow="A shared space"
        title="Team settings"
        description="Keep your team connected, with room to focus."
      />
      <SettingsNav current="team" />

      <div className="settings-content">
        <section className="settings-team-summary" aria-label="Your team">
          <div className="settings-team-identity">
            <span className="settings-team-symbol" aria-hidden="true">
              {team.name.charAt(0).toUpperCase()}
            </span>
            <div>
              <h2>{team.name}</h2>
              <p>{members.length} {members.length === 1 ? "person" : "people"} sharing this Emberspace</p>
            </div>
          </div>
          <span className="settings-role">{isHead ? "Team head" : "Team member"}</span>
        </section>
        {isHead && <TeamPolicyForm team={team} />}

        <TeamMembershipForm
          teamName={team.name}
          isHead={isHead}
          memberCount={members.length}
          successorName={isHead ? (successor?.display_name ?? null) : null}
        />
      </div>
    </>
  );
}
