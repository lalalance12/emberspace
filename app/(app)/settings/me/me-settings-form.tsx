"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ErrorNote, Field, Input, Toggle } from "@/components/ui/field";
import { messageForError } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  id: string;
  team_id: string | null;
  display_name: string;
  message_link: string | null;
  peer_nudges_enabled: boolean;
  system_nudges_enabled: boolean;
  nudges_paused_until: string | null;
}

/**
 * Nudge preferences, pause, and the message link a peer nudge points at.
 *
 * Joining and creating teams used to live here too. It moved to /onboarding —
 * this page is for someone who already has a board and wants to change how it
 * reaches them.
 */
export function MeSettingsForm({ profile }: { profile: Profile }) {
  const router = useRouter();

  const [displayName, setDisplayName] = useState(profile.display_name);
  const [messageLink, setMessageLink] = useState(profile.message_link ?? "");
  const [peer, setPeer] = useState(profile.peer_nudges_enabled);
  const [system, setSystem] = useState(profile.system_nudges_enabled);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    // The name is what the whole team reads on your card. An empty one leaves
    // a blank pinned to the board, so refuse it here rather than letting a
    // not-null constraint say something less useful.
    if (!displayName.trim()) {
      setError("Your name can't be empty — it's what the team sees on your card.");
      return;
    }

    setPending(true);

    const { error: err } = await createClient()
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        message_link: messageLink.trim() || null,
        peer_nudges_enabled: peer,
        system_nudges_enabled: system,
      })
      .eq("id", profile.id);

    setPending(false);
    if (err) setError(messageForError(err));
    else {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSave} onChange={() => setSaved(false)} className="settings-stack">
      <section className="settings-section" aria-labelledby="profile-heading">
        <div className="settings-section-heading">
          <h2 id="profile-heading">Your profile</h2>
          <p>A familiar name and a way for teammates to reach you.</p>
        </div>
        <div className="settings-fields">
        <Field label="Name" hint="How you appear across your workspace.">
          <Input
            required
            maxLength={60}
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Lance"
            data-testid="display-name"
          />
        </Field>

        <Field
          label="Your message link"
          hint="A link to your Slack, Discord, or wherever your team talks."
        >
          <Input
            type="url"
            value={messageLink}
            onChange={(e) => setMessageLink(e.target.value)}
            placeholder="https://slack.com/app_redirect?channel=you"
          />
        </Field>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="preferences-heading">
        <div className="settings-section-heading">
          <h2 id="preferences-heading">Nudge preferences</h2>
          <p>Choose how Workspace asks for your attention.</p>
        </div>
        <div className="settings-fields">
          <div className="settings-preference">
          <Toggle checked={peer} onChange={(value) => { setPeer(value); setSaved(false); }}>
            Let teammates nudge me
          </Toggle>
          <p>A small signal from a teammate to check your messages.</p>
          </div>
          <div className="settings-preference">
          <Toggle checked={system} onChange={(value) => { setSystem(value); setSaved(false); }}>
            Ask me when my status goes stale
          </Toggle>
          <p>A reminder to keep your update current, at your team&apos;s chosen pace.</p>
          </div>
          <div className="settings-form-footer">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save preferences"}
            </Button>
            {saved && <span role="status" className="settings-success">Preferences saved</span>}
          </div>
        </div>
      </section>

      {error && <ErrorNote>{error}</ErrorNote>}
    </form>
  );
}
