import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "./forgot-password-form";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      variant="signin"
      title={<>Forgot your password?</>}
      subtitle="Enter your email and we'll send a link to choose a new one."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="public-text-link">
            Sign in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
