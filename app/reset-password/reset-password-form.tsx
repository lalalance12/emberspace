"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ErrorNote, Field, Input } from "@/components/ui/field";
import { readableAuthError } from "@/lib/auth-errors";
import { authClient } from "@/lib/auth-client";

/**
 * Sets the new password with the token from the emailed link. The token is
 * single-use: Better Auth consumes it in the same step that writes the hash,
 * and revokes every session the old password had.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }

    setPending(true);
    try {
      const { error } = await authClient.resetPassword({ newPassword: password, token });

      if (error) {
        setExpired(error.code === "INVALID_TOKEN");
        setError(readableAuthError(error, "reset"));
        return;
      }

      router.replace("/login?reset=1");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="public-entry-form">
      <Field label="New password" hint="At least 8 characters.">
        <Input
          type="password"
          required
          autoFocus
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          data-testid="new-password"
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
          data-testid="confirm-password"
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full" data-testid="save-password">
        {pending ? "Saving…" : "Save new password"}
      </Button>

      {error && <ErrorNote>{error}</ErrorNote>}
      {expired && (
        <Link href="/forgot-password" className="public-text-link">
          Send a new reset link
        </Link>
      )}
    </form>
  );
}
