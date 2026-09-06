import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OnboardingChoice } from "./onboarding-choice";
import { Wordmark } from "@/components/brand-mark";
import { getViewer } from "@/lib/queries";

export const metadata: Metadata = { title: "Join a team" };

export default async function OnboardingPage() {
  const viewer = await getViewer();

  if (!viewer) {
    return (
      <Shell>
        <div className="public-onboarding-error panel">
          <p className="public-overline">Account setup</p>
          <h1>Your profile needs a hand.</h1>
          <p>You&rsquo;re signed in, but your profile wasn&rsquo;t created. Ask your team admin to help finish setting up your account.</p>
        </div>
      </Shell>
    );
  }

  if (viewer.profile.team_id) redirect("/board");

  return (
    <Shell>
      <div className="public-onboarding-content rise-in">
        <div className="public-onboarding-intro">
          <p className="public-overline">Make yourself at home</p>
          <h1>Find your team, {viewer.profile.display_name}.</h1>
          <p>Great work starts with a shared picture. Join your teammates or create a fresh workspace together.</p>
        </div>
        <OnboardingChoice />
        <p className="public-onboarding-note">You can manage your team in settings whenever you need to.</p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="public-onboarding">
      <header className="public-onboarding-header">
        <div className="public-wordmark"><Wordmark size={28} /></div>
        <ol className="public-onboarding-progress" aria-label="Account setup progress"><li><span aria-hidden="true">✓</span>Account created</li><li aria-current="step"><span aria-hidden="true">2</span>Your team</li></ol>
      </header>
      {children}
    </main>
  );
}
