import type { Metadata } from "next";
import Link from "next/link";

import { SignInForm } from "./sign-in-form";
import { AuthShell } from "@/components/auth-shell";
import { ErrorNote } from "@/components/ui/field";

export const metadata: Metadata = { title: "Sign in" };

/**
 * A failed code exchange used to redirect here with ?error=auth and say
 * nothing, which looks identical to arriving normally. Name what happened.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthShell
      title={
        <>
          Welcome back.
        </>
      }
      subtitle="Sign in to see what everyone is working on."
      footer={
        <>
          New to Workspace?{" "}
          <Link href="/signup" className="public-text-link">
            Create an account
          </Link>
        </>
      }
    >
      {error === "auth" && (
        <div className="mb-5">
          <ErrorNote>
            That sign-in link has expired or has already been used. Sign in
            with your email and password below.
          </ErrorNote>
        </div>
      )}

      <SignInForm />
    </AuthShell>
  );
}
