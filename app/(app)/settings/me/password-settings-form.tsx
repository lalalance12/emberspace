"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorNote, Field, Input } from "@/components/ui/field";
import { readableAuthError } from "@/lib/auth-errors";
import { authClient } from "@/lib/auth-client";

/**
 * Change the account password.
 *
 * Asks for the current one first. A signed-in browser left open on someone's
 * desk should not be enough to take the account over. It is a separate form
 * from the nudge preferences because forms cannot nest, and because a failed
 * password change should not look like a failed preference save.
 */
export function PasswordSettingsForm() {
  const [current, setCurrent] = useState("");
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
    const { error: err } = await authClient.changePassword({
      currentPassword: current,
      newPassword: password,
      // Other devices keep their sessions; this is a change, not a lockout.
      revokeOtherSessions: false,
    });
    setPending(false);

    if (err) {
      setError(readableAuthError(err, "password"));
      return;
    }

    setCurrent("");
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
        <Field label="Current password">
          <Input
            type="password"
            required
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
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
