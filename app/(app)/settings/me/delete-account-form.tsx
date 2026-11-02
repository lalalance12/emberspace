"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ErrorNote, Field, Input } from "@/components/ui/field";
import { readableAuthError } from "@/lib/auth-errors";
import { authClient } from "@/lib/auth-client";

/**
 * Deleting your own account.
 *
 * Two deliberate steps, like leaving a team: the button arms a confirmation
 * that says what disappears, and the confirmation asks for the password. A
 * browser left signed in on someone's desk is not enough to erase them.
 *
 * The server half is lib/auth.ts — beforeDelete releases the team membership
 * through leave_team(), so a head hands the team on, and the delete cascades
 * from there.
 */
export function DeleteAccountForm({ isHead, onTeam }: { isHead: boolean; onTeam: boolean }) {
  const router = useRouter();

  const [armed, setArmed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const consequences = [
    "Your account, your status history and your quick picks are deleted for good.",
    ...(onTeam ? ["You come off the board, and open nudges to and from you are settled."] : []),
    ...(isHead ? ["The longest-standing teammate becomes head of the team."] : []),
    "This can't be undone. Signing up again starts a new, empty account.",
  ];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const { error } = await authClient.deleteUser({ password });
      if (error) {
        setError(readableAuthError(error, "delete"));
        return;
      }
      router.replace("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="settings-section settings-section-danger" aria-labelledby="delete-heading">
      <div className="settings-section-heading">
        <h2 id="delete-heading">Delete your account</h2>
        <p>Remove yourself from Emberspace entirely, along with everything you have posted.</p>
      </div>

      <div className="settings-fields">
        {!armed ? (
          <div>
            <Button
              type="button"
              variant="quiet"
              onClick={() => setArmed(true)}
              className="settings-danger-button"
              data-testid="delete-account"
            >
              Delete account
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="settings-delete-confirm rise-in">
            <p className="text-sm font-medium">Before you do:</p>
            <ul className="settings-delete-list">
              {consequences.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>

            <Field label="Your password" hint="To confirm it's really you.">
              <Input
                type="password"
                required
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={pending}
                data-testid="delete-password"
              />
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending || !password} className="settings-delete-submit" data-testid="confirm-delete">
                {pending ? "Deleting…" : "Yes, delete my account"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setArmed(false);
                  setPassword("");
                  setError(null);
                }}
                disabled={pending}
              >
                Cancel
              </Button>
            </div>

            {error && <ErrorNote>{error}</ErrorNote>}
          </form>
        )}
      </div>
    </section>
  );
}
