"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ErrorNote, Field, Input } from "@/components/ui/field";
import { RpcError, createTeam, joinTeam } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";

type Pending = "join" | "create" | null;

/**
 * Two ways in, side by side. Not a wizard — there is no step 2, and hiding one
 * option behind a toggle would just make people guess which one they are.
 *
 * Both paths end at /board, because the first thing a new member should see is
 * what everyone else is on.
 */
export function OnboardingChoice() {
  const router = useRouter();

  const [joinCode, setJoinCode] = useState("");
  const [teamName, setTeamName] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(
    which: Exclude<Pending, null>,
    action: () => Promise<unknown>,
  ) {
    setError(null);
    setPending(which);
    try {
      await action();
      // refresh() first so the server components behind /board are rebuilt with
      // the team the profile now has, rather than the null it was cached with.
      router.refresh();
      router.replace("/board");
    } catch (err) {
      setPending(null);
      setError(
        err instanceof RpcError
          ? err.message
          : which === "join"
            ? "Couldn't join with that code. Check it with whoever sent it."
            : "Couldn't create that team. Try again.",
      );
    }
  }

  return (
    <div className="public-onboarding-choices">
      <div className="public-choice-grid">
        {/* Joining is the common path, so it carries the brand weight. */}
        <section
          className="public-choice public-choice-join"
          aria-labelledby="join-title"
        >
          <div className="public-choice-icon" aria-hidden="true"><svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2" /></svg></div>
          <p className="public-overline">Have an invitation?</p>
          <h2 id="join-title">Join your team</h2>
          <p className="public-choice-description">
            Your teammates are already here. Enter the eight-character code they shared with you.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run("join", () => joinTeam(createClient(), joinCode));
            }}
            className="public-entry-form"
          >
            <Field label="Join code">
              <Input
                required
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="K7QM4RXP"
                maxLength={8}
                autoComplete="off"
                spellCheck={false}
                className="public-join-code"
              />
            </Field>
            <Button type="submit" disabled={pending !== null} data-testid="join-team">
              {pending === "join" ? "Joining…" : "Join team"}
            </Button>
          </form>
        </section>

        <section className="public-choice" aria-labelledby="create-title">
          <div className="public-choice-icon" aria-hidden="true"><svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8M8 12h8" /></svg></div>
          <p className="public-overline">Bring everyone together</p>
          <h2 id="create-title">Start a new team</h2>
          <p className="public-choice-description">
            Give your team a home. Create a board and invite your teammates with a shared join code.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run("create", () =>
                createTeam(createClient(), teamName.trim()),
              );
            }}
            className="public-entry-form"
          >
            <Field label="Team name">
              <Input
                required
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Product"
                maxLength={60}
              />
            </Field>
            <Button
              type="submit"
              variant="quiet"
              disabled={pending !== null}
              data-testid="create-team"
            >
              {pending === "create" ? "Creating…" : "Create team"}
            </Button>
          </form>
        </section>
      </div>

      {error && <ErrorNote testId="onboarding-error">{error}</ErrorNote>}
    </div>
  );
}
