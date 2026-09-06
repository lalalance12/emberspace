import type { Metadata } from "next";
import Link from "next/link";

import { SignupForm } from "./signup-form";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <AuthShell
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
