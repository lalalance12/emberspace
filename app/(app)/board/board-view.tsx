"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";

import { NudgeBanner, type PeerNudge } from "@/components/nudge-banner";
import { NudgeComposer } from "@/components/nudge-composer";
import { StatusDetail } from "@/components/status-detail";
import { StateIcon } from "@/components/state-icon";
import { StatusNote, type NoteStatus } from "@/components/status-note";
import { EmptyState } from "@/components/ui/page";
import { getBoardSnapshot, type BoardSnapshot } from "@/app/live-actions";
import { usePoll } from "@/lib/use-poll";
import { STATUS_STATES, heatFor, presentationFor, type StatusState } from "@/lib/status-state";
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

/** How often the board asks for a fresh snapshot while the tab is visible. */
const POLL_MS = 5_000;

/**
 * The ember bed. Where an update sits is how hot it is: blockers burn above
 * everything, fresh posts glow as full cards, they settle into slim rows as
 * they warm down, and end in the ash as one-line chips. Resting states (break,
 * done, off) go straight to the ash — they are away, not stale.
 */
type Band = "burning" | "glowing" | "warm" | "ash";
const BANDS: ReadonlyArray<{ id: Band; title: string; hint: string; variant: "card" | "row" | "chip" }> = [
  { id: "burning", title: "Burning", hint: "Needs a hand", variant: "card" },
  { id: "glowing", title: "Glowing", hint: "Under an hour", variant: "card" },
  { id: "warm", title: "Warm", hint: "1 to 6 hours", variant: "row" },
  { id: "ash", title: "Ash", hint: "Gone cold or resting", variant: "chip" },
];

function bandFor(status: NoteStatus, now: number): Band {
  const heat = heatFor(status.state);
  if (heat === "burning") return "burning";
  if (heat === "resting") return "ash";
  const { tier } = decayFor({ startedAt: status.started_at, state: status.state, now });
  return tier === "fresh" ? "glowing" : tier === "stale" ? "ash" : "warm";
}

/**
 * The corkboard.
 *
 * Server Components fetched the initial data for a fast first paint; this
 * polls a snapshot (app/live-actions.ts) and swaps it in. One poll, three
 * answers:
 *
 *   status_updates — what people are DOING
 *   nudges         — who is being asked for attention
 *   presence       — whether they are THERE (a last-seen time, one row each)
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
  // does, so a polled update while it is open rewrites what you are reading
  // instead of leaving a stale snapshot on screen.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<StatusState | null>(null);
  const [sort, setSort] = useState<BoardSort>("name");
  const [connection, setConnection] = useState<Connection>("connecting");
  const [activity, setActivity] = useState<{ profileId: string; statusId: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // The poll compares against what is on screen, read here rather than inside
  // a state updater so the comparison runs once per poll.
  const statusesRef = useRef(statuses);
  statusesRef.current = statuses;
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

  // What used to arrive over three Realtime channels — status inserts, nudge
  // changes, presence — now comes as one snapshot every few seconds. The
  // snapshot is the truth: statuses and nudges are replaced wholesale, and a
  // status whose id changed since the last poll is a fresh post, which is what
  // lights the change ring.
  usePoll(async () => {
    let snapshot: BoardSnapshot | null;
    try {
      snapshot = await getBoardSnapshot(teamId);
    } catch {
      setConnection("reconnecting");
      return;
    }
    if (!snapshot) {
      setConnection("reconnecting");
      return;
    }

    setConnection("live");
    const prev = statusesRef.current;
    const fresh = snapshot.statuses
      .filter((s) => prev[s.profile_id] && prev[s.profile_id].id !== s.id)
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0];
    if (fresh) setActivity({ profileId: fresh.profile_id, statusId: fresh.id });
    setStatuses(Object.fromEntries(snapshot.statuses.map((s) => [s.profile_id, s as NoteStatus])));
    setNudges(snapshot.nudges);
    setOnline(new Set(snapshot.online));
  }, POLL_MS);

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
  // Array.prototype.sort is stable, so the chosen sort survives inside a band.
  const bandRank = (status: NoteStatus) => BANDS.findIndex((band) => band.id === bandFor(status, now));
  const bedded = [...visible].sort((a, b) => bandRank(a.status) - bandRank(b.status));
  const bandCounts = Object.fromEntries(BANDS.map((band) => [band.id, pinned.filter(({ status }) => bandFor(status, now) === band.id).length])) as Record<Band, number>;
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
          <div>
            <h2>The team&apos;s latest</h2>
            <p>{pinned.length === 0 ? "No embers lit yet today." : [
              bandCounts.glowing && `${bandCounts.glowing} glowing`,
              bandCounts.burning && `${bandCounts.burning} burning`,
              bandCounts.warm && `${bandCounts.warm} warm`,
              bandCounts.ash && `${bandCounts.ash} in the ash`,
            ].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        {/* One ember per teammate, so the team's heat reads before any card
            does. Decorative: the facts beside it carry the same numbers. */}
        <div className="board-coals" aria-hidden="true">
          {members.map((member) => {
            const status = statuses[member.id];
            if (!status) return <i key={member.id} data-unlit="true" />;
            const decay = decayFor({ startedAt: status.started_at, state: status.state, now });
            return <i key={member.id} data-heat={heatFor(status.state)} data-decay={decay.tier} />;
          })}
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
                initial={{ opacity: 0, transform: `translateY(${reduceMotion ? 0 : 5}px)` }} animate={{ opacity: 1, transform: "translateY(0px)" }} exit={{ opacity: 0, transform: `translateY(${reduceMotion ? 0 : -5}px)` }}
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
                <StateIcon state={state} />{presentationFor(state).label}{" "}
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
        <div className="ember-bed" aria-label="Current team updates">
          {visible.length === 0 && (
            <div className="board-empty-result">
              <EmptyState title="No matching updates" hint="Try another name, ticket, or status to find what you're looking for." />
            </div>
          )}
          {/* One flat list, ordered by band, with a heading row where each band
              starts. A card that cools from Glowing to Warm stays the same
              element in the same parent — it slides to its new place and keeps
              keyboard focus, instead of being torn down and rebuilt. */}
          {BANDS.flatMap((band) => {
            const rows = bedded.filter(({ status }) => bandFor(status, now) === band.id);
            if (rows.length === 0) return [];
            return [
              <motion.div layout={reduceMotion ? false : "position"} key={`band-${band.id}`} className="ember-band-heading" data-band={band.id}>
                <h3>{band.title}</h3>
                <span className="annotation">{band.hint}</span>
                <span className="ember-band-count">{rows.length}</span>
              </motion.div>,
              ...rows.map(({ member, status }) => {
                const isSelf = member.id === viewerId;
                const paused =
                  member.nudges_paused_until != null &&
                  new Date(member.nudges_paused_until).getTime() > now;
                const canNudge =
                  !isSelf && member.peer_nudges_enabled !== false && !paused;
                const index = bedded.findIndex((row) => row.member.id === member.id);
                const entranceDelay = initialIds.current.has(status.id) && !hasFilters ? Math.min(index * .045, .24) : 0;

                return (
                  <motion.div
                    key={member.id}
                    layout={reduceMotion ? false : "position"}
                    // CSS handles entrance under the user's motion media query.
                    // Keeping initial markup constant avoids SSR hydration drift.
                    initial={false}
                    animate={{ opacity: 1 }}
                    onAnimationComplete={() => initialIds.current.delete(status.id)}
                    transition={{
                      layout: { type: "spring", duration: 0.6, bounce: 0.15 },
                      opacity: { duration: reduceMotion ? 0 : .2 },
                    }}
                    className="board-card-cell group relative"
                    data-band={band.id}
                    data-variant={band.variant}
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
                        variant={band.variant}
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
              }),
            ];
          })}
        </div>
      )}

      {pinned.length > 0 && (
        <div className="board-footnote">
          <span className="freshness-key" aria-hidden="true"><i /><i /><i /><i /></span>
          <p>Fresh updates glow. Older ones cool to ash.{staleCount > 0 ? ` ${staleCount} update${staleCount === 1 ? " has" : "s have"} gone cold.` : ""}</p>
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
    <motion.span key={value} initial={{ opacity: 0, transform: `translateY(${reduceMotion ? 0 : 8}px)` }} animate={{ opacity: 1, transform: "translateY(0px)" }} exit={{ opacity: 0, transform: `translateY(${reduceMotion ? 0 : -8}px)` }} transition={{ duration: reduceMotion ? 0 : .2 }}>{value}</motion.span>
  </AnimatePresence></span>;
}
