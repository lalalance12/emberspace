import Link from "next/link";

import { Wordmark } from "@/components/brand-mark";
import { DecayDemo } from "@/components/decay-demo";

/** A shared, focused entry point for signing in and creating an account. */
export function AuthShell({ title, subtitle, children, footer }: {
  title: React.ReactNode;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="public-auth">
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
        <div className="public-auth-story-copy"><p className="public-overline">One shared picture</p><h2>Less checking in.<br />More getting on.</h2><p>A quiet place to see what everyone is working on, and where your team needs a hand.</p></div>
        <div className="public-auth-demo">
          <div className="public-auth-demo-header"><strong>Team board</strong><span>Example workspace</span></div>
          <DecayDemo now={Date.now()} variant="compact" />
        </div>
        <div className="public-auth-story-footer"><span className="public-freshness-track" aria-hidden="true"><i /><i /><i /><i /></span><p>Fresh updates stand out.<br />Blockers never fade into the background.</p></div>
      </aside>
    </main>
  );
}
