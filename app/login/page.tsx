import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInForm } from "./sign-in-form";
import { AuthShell } from "@/components/auth-shell";
import { getSessionUser } from "@/lib/queries";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  // Someone already signed in has no business on the front door.
  if (await getSessionUser()) redirect("/board");

  return (
    <AuthShell
      variant="signin"
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
      <SignInForm />
    </AuthShell>
  );
}
