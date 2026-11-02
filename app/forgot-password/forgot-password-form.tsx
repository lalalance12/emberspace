"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorNote, Field, Input } from "@/components/ui/field";
import { readableAuthError } from "@/lib/auth-errors";
import { authClient } from "@/lib/auth-client";

/**
 * Asks for a reset email.
 *
 * The answer is the same whether or not the address has an account — Better
 * Auth returns success either way, so this page cannot be used to find out who
 * is registered. The confirmation says "if", for the same reason.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const address = email.trim();
      const { error } = await authClient.requestPasswordReset({
        email: address,
        redirectTo: "/reset-password",
      });

      if (error) {
        setError(readableAuthError(error, "reset"));
        return;
      }

      setSentTo(address);
    } finally {
      setPending(false);
    }
  }

  if (sentTo) {
    return (
      <div className="public-entry-form" role="status">
        <p className="public-reset-sent">
          If <strong>{sentTo}</strong> has an Emberspace account, a reset link is on its way. It works
          once, for the next hour. Check your spam folder if it hasn&rsquo;t arrived in a few minutes.
        </p>
        <Button type="button" variant="quiet" onClick={() => setSentTo(null)} className="w-full">
          Send to a different address
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="public-entry-form">
      <Field label="Email">
        <Input
          type="email"
          required
          autoFocus
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          data-testid="email"
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full" data-testid="send-reset">
        {pending ? "Sending…" : "Send reset link"}
      </Button>

      {error && <ErrorNote>{error}</ErrorNote>}
    </form>
  );
}
