"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { StatusNote, type NoteStatus } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import { ErrorNote, Field, Input, Textarea } from "@/components/ui/field";
import { RpcError, setStatus } from "@/lib/rpc";
import { createClient } from "@/lib/data-client";
import {
  STATUS_STATES,
  presentationFor,
  type StatusState,
} from "@/lib/status-state";

interface QuickPick {
  id: string;
  state: string;
  note: string | null;
  ticket_ref: string | null;
}

interface Props {
  profileId: string;
  displayName: string;
  current: NoteStatus | null;
  quickPicks: QuickPick[];
  serverNow: number;
}

/**
 * Setting a status — the most important screen in the product.
 *
 *   submit
 *     -> optimistic local update (the card flips immediately)
 *     -> set_status, via a server action (app/actions.ts)
 *     -> Postgres closes the old row, inserts the new one, resolves any open
 *        system nudge, saves the quick pick
 *     -> every other board picks up the new row on its next poll (~5s)
 *
 * On failure the optimistic update rolls back and the message says what failed
 * and what to do. Never a bare "Something went wrong".
 *
 * The card on the right is not a mockup — it is the same StatusNote the board
 * renders, fed from local state as you type. Choosing a state recolours it
 * before you commit to anything.
 */
export function MeForm({
  profileId,
  displayName,
  current,
  quickPicks,
  serverNow,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [state, setState] = useState<StatusState>(
    (current?.state as StatusState) ?? "working",
  );
  const [note, setNote] = useState(current?.note ?? "");
  const [ticketRef, setTicketRef] = useState(current?.ticket_ref ?? "");
  const [customLabel, setCustomLabel] = useState(current?.custom_label ?? "");
  const [details, setDetails] = useState(current?.details ?? "");
  const [durationMinutes, setDurationMinutes] = useState<number | null>(
    current?.duration_minutes ?? null,
  );
  const [autoSwitchTo, setAutoSwitchTo] = useState<StatusState | null>(
    (current?.auto_switch_to as StatusState | null) ?? null,
  );
  const [preview, setPreview] = useState<NoteStatus | null>(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  // What the card would look like if posted now. Falls back to the saved status
  // so the panel is never empty while someone is mid-edit.
  const draft: NoteStatus | null =
    note.trim() || ticketRef.trim() || customLabel.trim() || details.trim() || preview
      ? {
          id: preview?.id ?? "draft",
          profile_id: profileId,
          state,
          note: note.trim() || null,
          ticket_ref: ticketRef.trim() || null,
          duration_minutes: durationMinutes,
          auto_switch_to: durationMinutes ? autoSwitchTo : null,
          custom_label: state === "other" ? customLabel.trim() || null : null,
          details: details.trim() || null,
          started_at: preview?.started_at ?? new Date(serverNow).toISOString(),
        }
      : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setPending(true);

    const rollbackTo = preview;

    // Optimistic: the card flips before the round trip.
    const optimistic: NoteStatus = {
      id: "optimistic",
      profile_id: profileId,
      state,
      note: note.trim() || null,
      ticket_ref: ticketRef.trim() || null,
      duration_minutes: durationMinutes,
      auto_switch_to: durationMinutes ? autoSwitchTo : null,
      custom_label: state === "other" ? customLabel.trim() || null : null,
      details: details.trim() || null,
      started_at: new Date().toISOString(),
    };
    setPreview(optimistic);

    try {
      const saved = await setStatus(createClient(), {
        state,
        note: note.trim() || null,
        ticketRef: ticketRef.trim() || null,
        durationMinutes,
        autoSwitchTo: durationMinutes ? autoSwitchTo : null,
        customLabel: state === "other" ? customLabel.trim() || null : null,
        details: details.trim() || null,
      });
      setPreview(saved as unknown as NoteStatus);
      setSaved(true);
      startTransition(() => router.refresh());
    } catch (err) {
      setPreview(rollbackTo);
      setError(
        err instanceof RpcError
          ? err.message
          : "That update didn't reach the board. Check your connection and post it again.",
      );
    } finally {
      setPending(false);
    }
  }

  function applyQuickPick(pick: QuickPick) {
    setState(pick.state as StatusState);
    setNote(pick.note ?? "");
    setTicketRef(pick.ticket_ref ?? "");
    // Quick picks carry the headline, not the paragraph. A custom label and
    // details are both written fresh each time — reusing yesterday's details
    // under today's note is how a board starts lying.
    setCustomLabel("");
    setDetails("");
  }

  return (
    <div className="status-workspace">
      <form onSubmit={onSubmit} onChange={() => setSaved(false)} className="status-editor">
        <section className="status-section" aria-labelledby="status-update-title">
          <div className="status-section-heading">
            <h2 id="status-update-title">Your update</h2>
            <p>Let your team know what has your attention.</p>
          </div>
        <fieldset className="status-state-field">
          <legend className="annotation">Choose a state</legend>
          <div className="status-state-grid">
            {STATUS_STATES.map((s) => {
              const look = presentationFor(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setState(s); setSaved(false); }}
                  aria-pressed={s === state}
                  className="status-state-choice"
                  style={
                    {
                      "--state": look.accent,
                      "--chip-ink": look.onAccent,
                    } as React.CSSProperties
                  }
                >
                  <span className="state-dot" aria-hidden="true" />
                  {look.label}
                  {s === state && <svg className="status-state-check" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="status-fields">
        {state === "other" && (
          <Field
            label="What state are you in?"
            hint="Shown on your card in place of a preset state."
          >
            <Input
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              maxLength={40}
              required
              autoFocus
              placeholder="Pairing, on a call, learning…"
            />
          </Field>
        )}

        <Field label="What you're on" hint={<span className="status-field-meta"><span>A short headline for your team.</span><span>{note.length}/140</span></span>}>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={140}
            placeholder="Fixing the checkout bug"
            className="status-note-input"
          />
        </Field>

        <Field
          label="Details"
          hint={
            <>
              <span className="status-field-meta"><span>Optional. Visible when someone opens your update.</span><span>{details.length}/2000</span></span>
            </>
          }
        >
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={2000}
            placeholder={
              "Add context, share progress, or explain where you need a hand."
            }
          />
        </Field>

        <Field label="Ticket" hint="Optional. Add a reference so your team can follow along.">
          <Input
            value={ticketRef}
            onChange={(e) => setTicketRef(e.target.value)}
            maxLength={32}
            placeholder="WS-118"
            className="font-[family-name:var(--font-mono)] text-sm uppercase"
          />
        </Field>
        </div>
        </section>

        <section className="status-section" aria-labelledby="status-timing-title">
          <div className="status-section-heading">
            <h2 id="status-timing-title">Give it a little time</h2>
            <p>Set an expected duration and choose what happens next.</p>
          </div>
          <div className="status-timing-grid">
        <Field label="Duration" hint="How long you expect to be on this.">
          <select
            value={durationMinutes ?? ""}
            onChange={(e) => {
              const next = e.target.value ? Number(e.target.value) : null;
              setDurationMinutes(next);
              // A target only makes sense with a timer to fire it.
              if (!next) setAutoSwitchTo(null);
            }}
            className="input"
          >
            <option value="">No timer</option>
            <option value="1">1 minute</option>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">1 hour</option>
          </select>
        </Field>

          <Field
            label="Then switch to"
            hint={durationMinutes ? "Your next state when the timer ends." : "Choose a duration to enable this."}
          >
            <select
              value={autoSwitchTo ?? ""}
              disabled={!durationMinutes}
              onChange={(e) =>
                setAutoSwitchTo((e.target.value || null) as StatusState | null)
              }
              className="input"
            >
              <option value="">Keep my current state</option>
              {STATUS_STATES.filter((s) => s !== "other").map((s) => (
                <option key={s} value={s}>
                  {presentationFor(s).label}
                </option>
              ))}
            </select>
          </Field>
          </div>
        </section>

        {error && <ErrorNote testId="status-error">{error}</ErrorNote>}
        <div className="status-save-bar">
          {saved ? <span role="status" className="status-saved">✓ Your update is on the board</span> : <p>Shared with your team when you post.</p>}
          <Button type="submit" disabled={pending} data-testid="post-update">
            {pending ? "Posting…" : "Post update"}
          </Button>
        </div>
      </form>

      <aside className="status-preview" aria-label="Update preview and recent updates">
        <section>
        <div className="status-preview-header">
          <h2>On the board</h2>
          <span className="status-preview-live">Live preview</span>
        </div>
        {draft ? (
          <StatusNote status={draft} name={displayName} now={serverNow} />
        ) : (
          <div className="status-preview-empty">
            <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="5" y="6" width="22" height="22" rx="5" stroke="currentColor" strokeWidth="1.5" /><path d="M11 14h10M11 19h7M16 3v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            <h3>Your update goes here</h3>
            <p>Add a headline to see how it will look on your team&apos;s board.</p>
          </div>
        )}
        <p className="status-preview-caption">
          A fresh update keeps its colour. As time passes, it gently fades so your team knows what&apos;s current.
        </p>
        </section>
        {quickPicks.length > 0 && (
          <section className="status-recent">
            <h2>Pick up where you left off</h2>
            <p>Start with one of your recent updates.</p>
            <div className="status-recent-list">
              {quickPicks.map((pick) => (
                <button
                  key={pick.id}
                  type="button"
                  onClick={() => { applyQuickPick(pick); setSaved(false); }}
                  className="status-recent-pick"
                  style={{ "--state": presentationFor(pick.state).accent } as React.CSSProperties}
                >
                  <span className="state-dot" aria-hidden="true" />
                  <span>{pick.note ?? presentationFor(pick.state).label}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}
