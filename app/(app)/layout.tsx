import { redirect } from "next/navigation";

import { TopBar } from "@/components/top-bar";
import { getSessionUser, getViewer } from "@/lib/queries";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware only saw that a cookie exists. An expired or forged one ends
  // here, and /login is safe to send it to: that page validates the session
  // too, so there is no loop.
  if (!(await getSessionUser())) redirect("/login");

  const viewer = await getViewer();

  // A valid session with no profile row is a schema problem, not a sign-in
  // problem, so say so instead of redirecting.
  if (!viewer) {
    return (
      <div className="canvas-ambient grid min-h-dvh place-items-center px-6">
        <div className="max-w-sm text-center">
          <p className="text-lg">You&rsquo;re signed in, but you have no profile.</p>
          <p className="annotation mt-2">
            A profile is created on signup by a database trigger. Ask an admin.
          </p>
        </div>
      </div>
    );
  }

  // Every route in this group reads by team_id. Rather than have each one
  // render its own version of "you're not on a team yet", the whole group
  // routes to the one screen that fixes it. /onboarding lives outside this
  // layout, so there is no loop.
  if (!viewer.profile.team_id) redirect("/onboarding");

  return (
    <div className="app-shell min-h-dvh">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <TopBar
        profileId={viewer.profile.id}
        displayName={viewer.profile.display_name}
        isHead={viewer.profile.role === "head"}
      />
      <main id="main-content" className="app-main" tabIndex={-1}>{children}</main>
    </div>
  );
}
