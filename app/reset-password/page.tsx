import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "./reset-password-form";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Choose a new password" };

/**
 * Where the emailed link lands. Better Auth's callback forwards here with
 * ?token=…, or with ?error=INVALID_TOKEN when the link has expired or was
 * already used — in which case there is nothing to fill in, only a way to ask
 * for a fresh one.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const usable = Boolean(token) && !error;

  return (
    <AuthShell
      variant="signin"
      title={usable ? <>Choose a new password.</> : <>This link has run out.</>}
      subtitle={
        usable
          ? "You'll be signed out everywhere else, then you can sign in with the new one."
          : "Reset links work once, for an hour. Ask for a fresh one and use the newest email."
      }
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="public-text-link">
            Sign in
          </Link>
        </>
      }
    >
      {usable ? (
        <ResetPasswordForm token={token!} />
      ) : (
        <div className="public-entry-form">
          <Link href="/forgot-password" className="btn btn-primary w-full">
            Send a new reset link
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
