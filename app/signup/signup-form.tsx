"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ErrorNote, Field, Input } from "@/components/ui/field";
import { readableAuthError } from "@/lib/auth-errors";
import { authClient } from "@/lib/auth-client";

/**
 * Creating an account. Valid inputs in, signed-in session out — no email, no
 * confirmation step, no waiting on a provider that rations messages by the
 * hour. Better Auth signs the new account straight in (autoSignIn in
 * lib/auth.ts), and the auth_user insert fires handle_new_user(), which makes
 * the profile.
 *
 * The display name is asked for rather than derived. The trigger falls back to
 * the local part of the email address, and nobody wants that pinned to their
 * card in front of the team.
 */
export function SignupForm() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const { error } = await authClient.signUp.email({
        name: displayName.trim(),
        email: email.trim(),
        password,
      });

      if (error) {
        setError(readableAuthError(error, "signup"));
        return;
      }

      router.refresh();
      router.replace("/onboarding");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="public-entry-form">
      <Field label="Name" hint="What your team sees on your card.">
        <Input
          required
          autoFocus
          autoComplete="name"
          maxLength={60}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name"
          data-testid="name"
        />
      </Field>

      <Field label="Email">
        <Input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          data-testid="email"
        />
      </Field>

      <Field label="Password" hint="At least 8 characters.">
        <Input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          data-testid="password"
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full" data-testid="create-account">
        {pending ? "Creating account…" : "Create account"}
      </Button>

      {error && <ErrorNote>{error}</ErrorNote>}
    </form>
  );
}
