"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorNote, Field, Input } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";

/**
 * Set or change the account password.
 *
 * This is what makes the password option on /login reachable for everyone:
 * anyone who signed up with an email link has no password at all, and without
 * this there is no way to acquire one. It is a separate form from the nudge
 * preferences because forms cannot nest, and because a failed password change
 * should not look like a failed preference save.
 */
export function PasswordSettingsForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }

    setPending(true);
    const { error: err } = await createClient().auth.updateUser({ password });
    setPending(false);

    if (err) {
      setError(
        /should be at least|weak password/i.test(err.message)
          ? "That password is too short. Use at least 8 characters."
          : `Couldn't change your password: ${err.message}`,
      );
      return;
    }

    setPassword("");
    setConfirm("");
    setSaved(true);
  }

  return (
    <form onSubmit={onSubmit} onChange={() => setSaved(false)} className="settings-stack">
      <section className="settings-section" aria-labelledby="password-heading">
        <div className="settings-section-heading">
          <h2 id="password-heading">Password</h2>
          <p>
            Keep your account secure with a password you don&apos;t use elsewhere.
          </p>
        </div>

        <div className="settings-fields">
        <div className="settings-field-grid">
        <Field label="New password" hint="At least 8 characters.">
          <Input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>

        <Field label="Confirm password">
          <Input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        </div>

      <div className="settings-form-footer">
        <Button type="submit" variant="quiet" disabled={pending}>
          {pending ? "Saving…" : "Save password"}
        </Button>
        {saved && <span role="status" className="settings-success">Password updated</span>}
      </div>
        </div>
      </section>

      {error && <ErrorNote>{error}</ErrorNote>}
    </form>
  );
}
