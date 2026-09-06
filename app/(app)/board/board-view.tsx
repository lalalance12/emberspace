"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";

import { NudgeBanner, type PeerNudge } from "@/components/nudge-banner";
import { NudgeComposer } from "@/components/nudge-composer";
import { StatusDetail } from "@/components/status-detail";
import { StatusNote, type NoteStatus } from "@/components/status-note";
import { EmptyState } from "@/components/ui/page";
import { createClient } from "@/lib/supabase/client";
import { STATUS_STATES, presentationFor, type StatusState } from "@/lib/status-state";
import { decayFor, isSignedOff } from "@/lib/staleness";

export interface BoardMember {
  id: string;
  display_name: string;
  message_link?: string | null;
  peer_nudges_enabled?: boolean;
  nudges_paused_until?: string | null;
}

interface Props {
  teamId: string;
  viewerId: string;
  members: BoardMember[];
  initialStatuses: NoteStatus[];
  initialNudges: PeerNudge[];
  /** Server clock at render time, so first paint matches on both sides. */
  serverNow: number;
}

type BoardSort = "name" | "latest" | "attention";
type Connection = "connecting" | "live" | "reconnecting";

/**
 * The corkboard.
 *
 * Server Components fetched the initial data for a fast first paint; this
 * subscribes to Realtime and patches that data in place. Three channels, three
 * jobs:
 *
 *   Postgres Changes on status_updates — what people are DOING
 *   Postgres Changes on nudges         — who is being asked for attention
 *   Presence                           — whether they are THERE
 *
 * Presence is never written to Postgres. There is no heartbeat row.
 */
export function BoardView({
  teamId,
  viewerId,
  members,
  initialStatuses,
  initialNudges,
  serverNow,
}: Props) {
  const [statuses, setStatuses] = useState<Record<string, NoteStatus>>(() =>
    Object.fromEntries(initialStatuses.map((s) => [s.profile_id, s])),
  );
  const [nudges, setNudges] = useState<PeerNudge[]>(initialNudges);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(serverNow);
  const [composingFor, setComposingFor] = useState<string | null>(null);
  // Which card's preview is open, held as a profile id rather than a copy of
  // the status. The dialog then reads out of the same `statuses` map the board
  // does, so a Realtime update while it is open rewrites what you are reading
  // instead of leaving a stale snapshot on screen.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<StatusState | null>(null);
  const [sort, setSort] = useState<BoardSort>("name");
  const [connection, setConnection] = useState<Connection>("connecting");
  const [activity, setActivity] = useState<{ profileId: string; statusId: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const initialIds = useRef(new Set(initialStatuses.map((status) => status.id)));
  const boardId = useId();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!activity) return;
    const timer = setTimeout(() => setActivity(null), 6000);
    return () => clearTimeout(timer);
  }, [activity]);

  const memberFor = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  );

  const nameFor = useMemo(
    () => (id: string | null) =>
      (id && memberFor.get(id)?.display_name) || "A teammate",
    [memberFor],
  );

  // Decay is time-based, so the board has to keep its own clock or notes would
  // only age on navigation.
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const changes = supabase
      .channel(`board-statuses:${teamId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "status_updates",
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          if (!active) return;
          const next = payload.new as NoteStatus;
          setStatuses((prev) => ({ ...prev, [next.profile_id]: next }));
          setActivity({ profileId: next.profile_id, statusId: next.id });
        },
      )
      .subscribe((status) => {
        if (active) setConnection(status === "SUBSCRIBED" ? "live" : "reconnecting");
      });

    return () => {
      active = false;
      void supabase.removeChannel(changes);
    };
  }, [teamId]);

  // Peer nudges are readable team-wide, so everyone's board reacts: the marker
  // appears on the recipient's card for the whole team, and the banner appears
  // for the recipient. Both from the same stream.
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`board-nudges:${teamId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "nudges",
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          const row = payload.new as PeerNudge & {
            kind?: string;
            state?: string;
          };
          if (row?.kind && row.kind !== "peer") return;

          setNudges((prev) => {
            const without = prev.filter((n) => n.id !== row.id);
            return row.state === "open" ? [row, ...without] : without;
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [teamId]);

  useEffect(() => {
    const supabase = createClient();

    const presence = supabase.channel(`team-presence:${teamId}`, {
      config: { presence: { key: viewerId } },
    });

    presence
      .on("presence", { event: "sync" }, () => {
        setOnline(new Set(Object.keys(presence.presenceState())));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void presence.track({ at: new Date().toISOString() });
        }
      });

    return () => {
      void supabase.removeChannel(presence);
    };
  }, [teamId, viewerId]);

  // The board shows the latest open nudge against you and nothing else. Peer
  // nudges stack by design, but a stack of banners turns the board into an
  // inbox — which is the one thing this product refuses to be. The full history
  // lives in the bell, where a list belongs.
  const latestForMe = nudges
    .filter((n) => n.recipient_id === viewerId)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 1);

  const olderForMe =
    nudges.filter((n) => n.recipient_id === viewerId).length - latestForMe.length;

  const nudgedIds = new Set(nudges.map((n) => n.recipient_id));

  const pinned = members
    .map((m) => ({ member: m, status: statuses[m.id] }))
    .filter((row): row is { member: BoardMember; status: NoteStatus } =>
      Boolean(row.status),
    );

  const searchTerm = search.trim().toLocaleLowerCase();
  const attentionRank = (status: NoteStatus) => status.state === "blocked" ? 0 :
    !isSignedOff(status.state) && decayFor({ startedAt: status.started_at, state: status.state, now }).tier === "stale" ? 1 : 2;
  const visible = pinned.filter(({ member, status }) =>
    (stateFilter === null || status.state === stateFilter) &&
    (!searchTerm || [member.display_name, status.note, status.ticket_ref, status.custom_label, presentationFor(status.state).label]
      .some((value) => value?.toLocaleLowerCase().includes(searchTerm))),
  ).sort((a, b) => {
    if (sort === "attention") {
      const rank = attentionRank(a.status) - attentionRank(b.status);
      if (rank !== 0) return rank;
    }
    if (sort === "latest") {
      const newest = new Date(b.status.started_at).getTime() - new Date(a.status.started_at).getTime();
      if (newest !== 0) return newest;
    }
    return a.member.display_name.localeCompare(b.member.display_name) || a.member.id.localeCompare(b.member.id);
  });
  const waiting = members.filter((member) => !statuses[member.id]);
  const blockedCount = pinned.filter(({ status }) => status.state === "blocked").length;
  const staleCount = pinned.filter(({ status }) => !isSignedOff(status.state) &&
    decayFor({ startedAt: status.started_at, state: status.state, now }).tier === "stale").length;
  // Keep the selected chip reachable if its last matching status changes live.
  const statesPresent = STATUS_STATES.filter((state) => state === stateFilter || pinned.some(({ status }) => status.state === state));
  const hasFilters = Boolean(searchTerm || stateFilter);

  // A card can go away underneath an open preview — the person posts nothing
  // for long enough that a realtime patch replaces the row, or they leave the
  // team. Resolve through the live map every render so the dialog closes with
  // the card rather than holding a status that is no longer on the board.
  const openStatus = openFor ? (statuses[openFor] ?? null) : null;

  return (
    <LayoutGroup id={boardId}>
    <div className="board-page">
      <NudgeBanner
        nudges={latestForMe}
        olderCount={olderForMe}
        nameFor={nameFor}
        onAcknowledged={(id) =>
          setNudges((prev) => prev.filter((n) => n.id !== id))
        }
      />

      <section className="board-overview board-overview-live" aria-label="Team overview">
        <div className="board-overview-main">
        <div className="board-overview-intro">
          <span className="board-overview-icon" aria-hidden="true">
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>
          </span>
          <div>
            <h2>The team&apos;s latest</h2>
            <p>One update per person. A little less standup.</p>
          </div>
        </div>
        <dl className="board-overview-facts">
          <div><dt>Teammates</dt><dd><AnimatedCount value={members.length} /></dd></div>
          <div><dt>Posted</dt><dd><AnimatedCount value={pinned.length} /></dd></div>
          <div><dt>Here now</dt><dd><AnimatedCount value={members.filter((member) => online.has(member.id)).length} /></dd></div>
          <div data-attention={blockedCount > 0}><dt>Blocked</dt><dd><AnimatedCount value={blockedCount} /></dd></div>
        </dl>
        </div>
        <div className="board-live-strip">
          <span className="board-connection" data-connection={connection} role="status">
            <span aria-hidden="true" />
            {connection === "live" ? "Live updates" : connection === "connecting" ? "Connecting…" : "Reconnecting…"}
          </span>
          <div className="board-activity" role="status" aria-live="polite" aria-atomic="true">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={activity?.statusId ?? connection}
                initial={{ opacity: 0, y: reduceMotion ? 0 : 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduceMotion ? 0 : -5 }}
                transition={{ duration: reduceMotion ? 0 : .18 }}>
                {activity ? `${nameFor(activity.profileId)} updated their status` : connection === "reconnecting" ? "Showing the last received updates" : "A shared picture, without refreshing"}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {pinned.length > 0 && (
        <div className="board-controls">
          <div className="board-toolbar">
            <div className="board-section-title"><h2>Current updates</h2><span className="count-badge">{hasFilters ? `${visible.length} / ${pinned.length}` : pinned.length}</span></div>
            <div className="board-toolbar-actions">
            <label className="board-search">
              <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
              <input ref={searchRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setSearch(""); }} placeholder="Search people or updates…" aria-label="Search people or updates" />
            </label>
            <label className="board-sort">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h11M4 18h5" /></svg>
              <select aria-label="Sort updates" value={sort} onChange={(event) => setSort(event.target.value as BoardSort)}>
                <option value="name">Name A–Z</option><option value="latest">Latest updates</option><option value="attention">Needs attention</option>
              </select>
            </label>
            </div>
          </div>
          <div className="board-filter-row" role="group" aria-label="Filter updates by status">
            <button type="button" className="board-filter" aria-pressed={stateFilter === null} onClick={() => setStateFilter(null)}>
              {stateFilter === null && <FilterHighlight reduceMotion={Boolean(reduceMotion)} />}All updates <span>{pinned.length}</span>
            </button>
            {statesPresent.map((state) => (
              <button key={state} type="button" className="board-filter" aria-pressed={stateFilter === state} onClick={() => setStateFilter(stateFilter === state ? null : state)} style={{ "--state": presentationFor(state).accent } as React.CSSProperties}>
                {stateFilter === state && <FilterHighlight reduceMotion={Boolean(reduceMotion)} />}
                <span className="state-dot" aria-hidden="true" />{presentationFor(state).label}{" "}
                <span>{pinned.filter(({ status }) => status.state === state).length}</span>
              </button>
            ))}
            {hasFilters && <button type="button" className="board-reset" onClick={() => { setSearch(""); setStateFilter(null); searchRef.current?.focus(); }}>Clear filters <span aria-hidden="true">×</span></button>}
          </div>
        </div>
      )}

      {pinned.length === 0 ? (
        <EmptyState
          title="A fresh board for your team"
          hint="Share what you're working on. Your update gives everyone a place to start."
          action={
            <Link href="/me" className="btn btn-primary">
              Post the first update
            </Link>
          }
        />
      ) : (
        <div className="status-card-grid board-animated-grid" aria-label="Current team updates">
          <AnimatePresence mode="popLayout">
            {visible.length === 0 && <motion.div key="empty" className="board-empty-result"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : .18 }}>
              <EmptyState title="No matching updates" hint="Try another name, ticket, or status to find what you're looking for." />
            </motion.div>}
            {visible.map(({ member, status }, index) => {
              const isSelf = member.id === viewerId;
              const paused =
                member.nudges_paused_until != null &&
                new Date(member.nudges_paused_until).getTime() > now;
              const canNudge =
                !isSelf && member.peer_nudges_enabled !== false && !paused;
              const entranceDelay = initialIds.current.has(status.id) && !hasFilters ? Math.min(index * .045, .24) : 0;

              return (
                <motion.div
                  key={member.id}
                  layout={reduceMotion ? false : "position"}
                  // CSS handles entrance under the user's motion media query.
                  // Keeping initial markup constant avoids SSR hydration drift.
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.97 }}
                  onAnimationComplete={() => initialIds.current.delete(status.id)}
                  transition={{
                    layout: { type: "spring", stiffness: 380, damping: 34 },
                    opacity: { duration: reduceMotion ? 0 : .2 },
                    scale: { duration: reduceMotion ? 0 : .16 },
                  }}
                  className="board-card-cell group relative"
                >
                  <div className="board-card-content" style={{ "--board-enter-delay": `${entranceDelay}s` } as React.CSSProperties}>
                    {activity?.statusId === status.id && <motion.span key={status.id} className="board-change-ring" aria-hidden="true"
                      initial={{ opacity: 0 }} animate={{ opacity: reduceMotion ? 1 : [0, 1, 1, 0] }}
                      transition={{ duration: reduceMotion ? 0 : 2.4, times: [0, .15, .6, 1] }} />}
                    <StatusNote
                      status={status}
                      name={member.display_name}
                      now={now}
                      isSelf={isSelf}
                      online={online.has(member.id)}
                      onOpen={() => setOpenFor(member.id)}
                      action={
                        <span className="relative flex shrink-0 items-center gap-1.5">
                          {/* Nudged is public on purpose — nudging in the open
                              keeps it social. */}
                          {nudgedIds.has(member.id) && (
                            <span className="tag">Nudged</span>
                          )}

                          {canNudge && (
                            <button
                              type="button"
                              onClick={() =>
                                setComposingFor((v) =>
                                  v === member.id ? null : member.id,
                                )
                              }
                              aria-expanded={composingFor === member.id}
                              aria-label={`Nudge ${member.display_name}`}
                              className="note-nudge-button"
                            >
                              Nudge
                            </button>
                          )}

                        </span>
                      }
                    />
                  </div>

                  {/* Sibling of the card, not a child. Inside it, the popover
                      was bounded by the card and appeared cut off. */}
                  {composingFor === member.id && (
                    <NudgeComposer
                      recipientId={member.id}
                      recipientName={member.display_name}
                      onClose={() => setComposingFor(null)}
                      onSent={() => setComposingFor(null)}
                    />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {pinned.length > 0 && (
        <div className="board-footnote">
          <span className="freshness-key" aria-hidden="true"><i /><i /><i /><i /></span>
          <p>Fresh updates hold their color. Older ones fade.{staleCount > 0 ? ` ${staleCount} update${staleCount === 1 ? " is" : "s are"} over 6 hours old.` : ""}</p>
        </div>
      )}

      {waiting.length > 0 && pinned.length > 0 && !searchTerm && stateFilter === null && (
        <section className="board-waiting" aria-label="Teammates without an update">
          <div><h2>Yet to check in <span>{waiting.length}</span></h2><p>Their latest update will appear here.</p></div>
          <div className="board-waiting-people">{waiting.map((member) => <span key={member.id}><i aria-hidden="true">{member.display_name.trim().slice(0, 1).toUpperCase()}</i>{member.display_name}{member.id === viewerId && <Link href="/me">Post yours <span aria-hidden="true">↗</span></Link>}</span>)}</div>
        </section>
      )}

      <StatusDetail
        status={openStatus}
        name={nameFor(openFor)}
        now={now}
        isSelf={openFor === viewerId}
        open={openStatus !== null}
        onClose={() => setOpenFor(null)}
      />
    </div>
    </LayoutGroup>
  );
}

function FilterHighlight({ reduceMotion }: { reduceMotion: boolean }) {
  return <motion.span className="board-filter-highlight" layoutId="board-filter" aria-hidden="true"
    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 450, damping: 35 }} />;
}

function AnimatedCount({ value }: { value: number }) {
  const reduceMotion = useReducedMotion();
  return <span className="board-count"><AnimatePresence mode="popLayout" initial={false}>
    <motion.span key={value} initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }} transition={{ duration: reduceMotion ? 0 : .2 }}>{value}</motion.span>
  </AnimatePresence></span>;
}
