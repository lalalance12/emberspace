import Link from "next/link";

import { Wordmark } from "@/components/brand-mark";
import { AuthBoard, type AuthBoardVariant } from "@/components/auth-board";
import { WaveBackdrop } from "@/components/landing-scenes";

/**
 * The right-hand story changes with the page: sign in shows the board you are
 * returning to, sign up shows the one you are about to start. Same frame, so
 * moving between the two pages reads as one place with a different view.
 */
const stories: Record<AuthBoardVariant, { overline: string; title: React.ReactNode; body: string; footer: React.ReactNode }> = {
  signin: {
    overline: "One shared picture",
    title: <>Less checking in.<br />More getting on.</>,
    body: "A quiet place to see what everyone is working on, and where your team needs a hand.",
    footer: <>Fresh updates stand out.<br />Blockers never fade into the background.</>,
  },
  signup: {
    overline: "Set up in a minute",
    title: <>Start the board.<br />Bring the team.</>,
    body: "Create a team, share its join code, and the board fills in as people post what they are on.",
    footer: <>No invites, no inbox.<br />One code and everyone is in the picture.</>,
  },
};

/** A shared, focused entry point for signing in and creating an account. */
export function AuthShell({ variant, title, subtitle, children, footer }: {
  variant: AuthBoardVariant;
  title: React.ReactNode;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const story = stories[variant];

  return (
    <main className="public-auth">
      <WaveBackdrop />
      <section className="public-auth-main">
        <Link href="/" className="public-wordmark public-auth-logo" aria-label="Workspace home"><Wordmark size={28} /></Link>
        <div className="public-auth-form rise-in">
          <p className="public-overline">Your team, in the loop</p>
          <h1>{title}</h1>
          <p className="public-auth-subtitle">{subtitle}</p>
          {children}
          <div className="public-auth-footer">{footer}</div>
        </div>
        <p className="public-auth-bottom">A little more clarity in your workday.</p>
      </section>
      <aside className="public-auth-story" aria-label="About Workspace">
        <span className="auth-story-wave auth-story-wave-1" aria-hidden="true" />
        <span className="auth-story-wave auth-story-wave-2" aria-hidden="true" />
        <span className="auth-story-glow" aria-hidden="true" />
        <div className="public-auth-story-copy" key={variant}><p className="public-overline">{story.overline}</p><h2>{story.title}</h2><p>{story.body}</p></div>
        <AuthBoard variant={variant} />
        <div className="public-auth-story-footer"><span className="public-freshness-track" aria-hidden="true"><i /><i /><i /><i /></span><p>{story.footer}</p></div>
      </aside>
    </main>
  );
}
