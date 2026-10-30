import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignupForm } from "./signup-form";
import { AuthShell } from "@/components/auth-shell";
import { getSessionUser } from "@/lib/queries";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  // Someone already signed in has no business on the front door.
  if (await getSessionUser()) redirect("/board");

  return (
    <AuthShell
      variant="signup"
      title={
        <>
          Create your account.
        </>
      }
      subtitle="Create an account, then join a team or start one."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="public-text-link">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
