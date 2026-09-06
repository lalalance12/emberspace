import type { ReactNode } from "react";

import { decayFor } from "@/lib/staleness";
import { presentationFor } from "@/lib/status-state";

export interface NoteStatus {
  id: string;
  profile_id: string;
  state: string;
  note: string | null;
  ticket_ref: string | null;
  duration_minutes: number | null;
  /** Only read by the /me form to re-fill its picker; the card never shows it. */
  auto_switch_to?: string | null;
  /** The person's own words, shown in place of the label when state is 'other'. */
  custom_label?: string | null;
  /**
   * The long half. Never drawn on the card — the preview is what opens it. Its
   * presence is the only thing the card shows, as a marker in the footer.
   */
  details?: string | null;
  started_at: string;
}

interface Props {
  status: NoteStatus;
  name: string;
  /**
   * Supplied by the caller rather than read from Date.now() so the server and
   * client agree on first paint. The board ticks it once a minute.
   */
  now: number;
  /** Live presence supplied by the board, separate from the person's status. */
  online?: boolean;
  isSelf?: boolean;
  /**
   * Rendered at the right of the header row. A slot rather than a set of
   * flags — the board puts a nudge control here, the timeline puts nothing, and
   * the card does not need to know which is which. Anything placed here shares
   * the header's row, so it can never land on top of the status text or the
   * footer the way an absolutely positioned overlay did.
   */
  action?: ReactNode;
  /**
   * Opens the preview. Optional: the board passes it, the /me draft card and
   * the timeline do not — a card you are still typing has nothing to expand to,
   * and the timeline is already the long view.
   *
   * Rendered as a button stretched over the whole card rather than by making
   * the card itself clickable. The card contains the Nudge button, and a button
   * inside a button is invalid HTML that screen readers cannot announce. As a
   * sibling under the interactive bits it gets keyboard focus, Enter and Space
   * for free, and nests nothing.
   */
  onOpen?: () => void;
}

/**
 * A status card.
 *
 * Two elements, not one. The avatar overhangs the card's top-left corner, so it
 * is a sibling of the card rather than a child of it, and a wrapper carries
 * data-decay and --state for both of them to inherit from one place. (It began
 * as a workaround for a clip-path that took a bite out of an ageing card and
 * cut off anything crossing the boundary. That went with the geometry; the
 * structure stayed, because one element owning the tint is still right.)
 *
 * The decay treatment stays data-driven: data-decay carries the tier and the
 * CSS mixes every colour against it. The card gets two inputs — --state from
 * the status, --tint from its age — and everything else falls out of those.
 *
 * The mono age label is always rendered. Under prefers-reduced-motion, with the
 * breathing gone, it is the entire staleness signal.
 */
export function StatusNote({ status, name, now, action, onOpen, online, isSelf }: Props) {
  const decay = decayFor({
    startedAt: status.started_at,
    state: status.state,
    now,
  });
  const look = presentationFor(status.state);
  const blocked = status.state === "blocked";
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";
  // For 'other', the person's own words stand in for the generic state name.
  const label =
    status.state === "other" && status.custom_label
      ? status.custom_label
      : look.label;

  return (
    <div
      className="note-wrap status-card-wrap"
      data-decay={decay.tier}
      data-blocked={blocked}
      style={{ "--state": look.accent } as React.CSSProperties}
    >
      <article
        className="note status-card"
        data-decay={decay.tier}
        data-blocked={blocked}
        data-testid="status-note"
        data-state={status.state}
        data-profile-id={status.profile_id}
      >
        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            data-testid="open-status"
            className="note-open"
            // The card's own text is the accessible name of everything under
            // this button, so the button has to say what it does instead.
            aria-label={`Open ${name}'s status`}
          />
        )}

        <header className="status-card-person">
          <div className="status-card-identity">
            <h3>{name}{isSelf && <span className="status-card-you">you</span>}</h3>
            <span className="status-card-presence">
              {online !== undefined ? <><i data-online={online} aria-hidden="true" />{online ? "Here now" : "Away from the board"}</> : "Status update"}
            </span>
          </div>
        </header>

        <div className="status-card-labels">
          <span className="status-card-state"><span className="state-dot" aria-hidden="true" />{label}</span>
            {status.duration_minutes != null && (
              <span
                className="status-card-duration"
                title={`Planned for ${status.duration_minutes} minutes`}
              >
                {status.duration_minutes} min
              </span>
            )}
        </div>

        {/* Clamped to three lines. The database allows 140 characters and the
            card is one column of a grid: unclamped, one wordy status makes its
            card taller than every neighbour and the row it sits in goes with
            it. The full text is one click away. */}
        <p className="note-text note-clamp status-card-headline">
          {status.note ?? label}
        </p>

        <div className="status-card-meta">
          <span className="status-card-reference">
            {status.ticket_ref && <span className="status-ticket">{status.ticket_ref}</span>}
            {/* The only trace details leave on the card. Under the stretched
                trigger on purpose, so pressing the thing that says there is
                more is what opens it. */}
            {status.details && (
              <span
                className="status-details-marker"
                title="Additional details in this update"
              >
                + details
              </span>
            )}
          </span>
          <span
            className="status-card-age"
            title={new Date(status.started_at).toLocaleString()}
          >
            {decay.annotation ?? decay.age}
          </span>
        </div>

        <footer className="status-card-footer">
          <span className="status-card-open-hint">{onOpen ? <>View update <span aria-hidden="true">↗</span></> : "Latest status"}</span>
          <div className="status-card-action">{action}</div>
        </footer>
      </article>

      {/* Sibling, not child: see the note above. */}
      <span
        className="avatar status-card-avatar"
        aria-hidden="true"
        title={name}
      >
        {initial}
      </span>
    </div>
  );
}
