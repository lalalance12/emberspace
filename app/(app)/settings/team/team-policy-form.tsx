"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ErrorNote, Field, Input, Toggle } from "@/components/ui/field";
import { RpcError, messageForError, rotateJoinCode } from "@/lib/rpc";
import { updateTeamPolicy } from "@/app/actions";
import { createClient } from "@/lib/data-client";

export interface TeamPolicy {
  id: string;
  name: string;
  join_code: string;
  stale_after_minutes: number;
  renudge_after_minutes: number;
  system_nudges_enabled: boolean;
  peer_nudges_per_hour: number;
  peer_nudges_per_recipient_per_hour: number;
}

/**
 * The head edits nudge policy here.
 *
 * These write straight to public.teams — no RPC needed, because the "head
 * updates own team" policy plus the table GRANT already say exactly who may.
 * A member reaching this page is redirected before it renders.
 *
 * The bounds below are not UI preferences. They mirror CHECK constraints on the
 * table, so a value outside them is refused by Postgres whatever the input
 * says. Stating them in the hint means nobody discovers the limit by hitting it.
 */
const BOUNDS = {
  stale_after_minutes: { min: 15, max: 1440 },
  renudge_after_minutes: { min: 15, max: 1440 },
  peer_nudges_per_recipient_per_hour: { min: 0, max: 20 },
  peer_nudges_per_hour: { min: 0, max: 100 },
} as const;

export function TeamPolicyForm({ team }: { team: TeamPolicy }) {
  const router = useRouter();

  const [name, setName] = useState(team.name);
  const [stale, setStale] = useState(String(team.stale_after_minutes));
  const [renudge, setRenudge] = useState(String(team.renudge_after_minutes));
  const [system, setSystem] = useState(team.system_nudges_enabled);
  const [perPerson, setPerPerson] = useState(
    String(team.peer_nudges_per_recipient_per_hour),
  );
  const [perHour, setPerHour] = useState(String(team.peer_nudges_per_hour));

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [code, setCode] = useState(team.join_code);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const numbers = {
      stale_after_minutes: Number(stale),
      renudge_after_minutes: Number(renudge),
      peer_nudges_per_recipient_per_hour: Number(perPerson),
      peer_nudges_per_hour: Number(perHour),
    };

    for (const [key, value] of Object.entries(numbers)) {
      const { min, max } = BOUNDS[key as keyof typeof BOUNDS];
      if (!Number.isInteger(value) || value < min || value > max) {
        setError(
          `${LABELS[key as keyof typeof LABELS]} has to be a whole number between ${min} and ${max}.`,
        );
        return;
      }
    }

    if (!name.trim()) {
      setError("The team needs a name — it's the heading on this page.");
      return;
    }

    // A re-nudge window shorter than the staleness window means the scheduler
    // becomes eligible again before the status it is chasing has even gone
    // stale, which reads as nagging. Postgres allows it; say something.
    if (numbers.renudge_after_minutes < numbers.stale_after_minutes) {
      setError(
        "Re-nudge after should be at least as long as Stale after, or people get asked again before the next status has had time to age.",
      );
      return;
    }

    setPending(true);
    const { error: err } = await updateTeamPolicy(team.id, { name: name.trim(), system_nudges_enabled: system, ...numbers });
    setPending(false);

    if (err) setError(messageForError(err));
    else {
      setSaved(true);
      router.refresh();
    }
  }

  async function onRotate() {
    setError(null);
    setCopyFeedback(null);
    setRotating(true);
    try {
      const next = await rotateJoinCode(createClient());
      // The RPC returns the new code; take it rather than refetching.
      if (typeof next === "string") setCode(next);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof RpcError ? err.message : "Couldn't rotate the code.",
      );
    } finally {
      setRotating(false);
    }
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyFeedback("Copied");
    } catch {
      setCopyFeedback("Select the code to copy it.");
    }
  }

  return (
    <div className="settings-stack">
      <section className="settings-invite" aria-labelledby="invite-heading">
        <div>
          <h2 id="invite-heading">Make room for your team</h2>
          <p>Share this join code to bring a teammate into your Emberspace. Anyone with the code can join.</p>
          <p>Rotating it replaces the code immediately. Current members stay.</p>
        </div>
        <div className="settings-invite-code">
          <code data-testid="join-code">{code}</code>
          <div className="settings-code-actions">
            <Button variant="quiet" type="button" onClick={() => void onCopy()} disabled={rotating}>Copy code</Button>
        <Button
          variant="ghost"
          type="button"
          onClick={() => void onRotate()}
          disabled={rotating}
        >
          {rotating ? "Rotating…" : "Rotate code"}
        </Button>
          </div>
          {copyFeedback && <span className="settings-success" role="status">{copyFeedback}</span>}
        </div>
      </section>

      <form onSubmit={onSave} onChange={() => setSaved(false)} className="settings-stack">
        <section className="settings-section" aria-labelledby="team-name-heading">
          <div className="settings-section-heading">
            <h2 id="team-name-heading">Team details</h2>
            <p>The name of the space you share.</p>
          </div>
          <Field label="Name">
            <Input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="team-name"
            />
          </Field>
        </section>

        <section className="settings-section" aria-labelledby="system-nudges-heading">
          <div className="settings-section-heading">
            <h2 id="system-nudges-heading">Status reminders</h2>
            <p>
              Give your team a gentle reminder when an update needs a refresh.
            </p>
          </div>

          <div className="settings-fields">
          <Toggle checked={system} onChange={(value) => { setSystem(value); setSaved(false); }}>
            Ask people to update when their status goes stale
          </Toggle>

          <div className="settings-field-grid">
          <Field
            label="Stale after (minutes)"
            hint={`Send the first reminder after this long. ${BOUNDS.stale_after_minutes.min}–${BOUNDS.stale_after_minutes.max} minutes.`}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={BOUNDS.stale_after_minutes.min}
              max={BOUNDS.stale_after_minutes.max}
              value={stale}
              onChange={(e) => setStale(e.target.value)}
              disabled={!system}
              data-testid="stale-after"
            />
          </Field>

          <Field
            label="Re-nudge after (minutes)"
            hint={`Wait this long before asking again. ${BOUNDS.renudge_after_minutes.min}–${BOUNDS.renudge_after_minutes.max} minutes.`}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={BOUNDS.renudge_after_minutes.min}
              max={BOUNDS.renudge_after_minutes.max}
              value={renudge}
              onChange={(e) => setRenudge(e.target.value)}
              disabled={!system}
              data-testid="renudge-after"
            />
          </Field>
          </div>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="peer-nudges-heading">
          <div className="settings-section-heading">
            <h2 id="peer-nudges-heading">Teammate nudges</h2>
            <p>
              Set a comfortable pace for getting each other&apos;s attention. Set either limit to 0 to turn these off.
            </p>
          </div>

          <div className="settings-fields">
          <div className="settings-field-grid">
          <Field
            label="Per person, per hour"
            hint={`Nudges to the same teammate. ${BOUNDS.peer_nudges_per_recipient_per_hour.min}–${BOUNDS.peer_nudges_per_recipient_per_hour.max}.`}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={BOUNDS.peer_nudges_per_recipient_per_hour.min}
              max={BOUNDS.peer_nudges_per_recipient_per_hour.max}
              value={perPerson}
              onChange={(e) => setPerPerson(e.target.value)}
              data-testid="per-recipient"
            />
          </Field>

          <Field
            label="Total, per hour"
            hint={`All nudges one person can send. ${BOUNDS.peer_nudges_per_hour.min}–${BOUNDS.peer_nudges_per_hour.max}.`}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={BOUNDS.peer_nudges_per_hour.min}
              max={BOUNDS.peer_nudges_per_hour.max}
              value={perHour}
              onChange={(e) => setPerHour(e.target.value)}
              data-testid="per-hour"
            />
          </Field>
          </div>

        <div className="settings-form-footer">
          <Button type="submit" disabled={pending} data-testid="save-policy">
            {pending ? "Saving…" : "Save policy"}
          </Button>
          {saved && <span role="status" className="settings-success">Policy saved</span>}
        </div>
          </div>
        </section>

        {error && <ErrorNote>{error}</ErrorNote>}
      </form>
    </div>
  );
}

const LABELS = {
  stale_after_minutes: "Stale after",
  renudge_after_minutes: "Re-nudge after",
  peer_nudges_per_recipient_per_hour: "Per person, per hour",
  peer_nudges_per_hour: "Total, per hour",
} as const;
