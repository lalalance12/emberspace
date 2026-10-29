import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Wordmark } from "@/components/brand-mark";
import { HeroBoard, LandingExperience, RevealSection, ScrollStory } from "@/components/landing-scenes";
import { Icon } from "@/components/ui/icon";
import { getSessionUser } from "@/lib/queries";

export const metadata: Metadata = {
  title: { absolute: "Workspace — an ambient status board for your team" },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export default async function Home() {
  if (await getSessionUser()) redirect("/board");

  return (
    <LandingExperience>
      <a href="#main-content" className="landing-skip-link">Skip to content</a>
      <header className="public-header">
        <Link href="/" aria-label="Workspace home" className="public-wordmark"><Wordmark size={28} /></Link>
        <nav aria-label="Main navigation" className="public-nav">
          <a href="#how-it-works" className="public-how-link">How it works</a>
          <Link href="/login" className="btn btn-ghost">Sign in</Link>
          <Link href="/signup" className="btn btn-primary">Get started <Icon name="arrow" width="17" height="17" /></Link>
        </nav>
      </header>

      <main id="main-content" className="landing-main">
        <section className="landing-hero" aria-labelledby="hero-title">
          <div className="landing-hero-copy">
            <p className="public-eyebrow landing-enter"><span /> A calmer way to stay in sync</p>
            <h1 id="hero-title" className="landing-enter"><span className="landing-line">Your team&rsquo;s day.</span><br /><em className="landing-line">At a glance.</em></h1>
            <p className="landing-hero-description landing-enter">Know what&rsquo;s moving, who&rsquo;s focused, and where a little help could make a difference. All on one shared board.</p>
            <div className="landing-hero-actions landing-enter">
              <Link href="/signup" className="btn btn-primary">Start your workspace <Icon name="arrow" width="18" height="18" /></Link>
              <Link href="/login" className="landing-inline-link">Join your team <span aria-hidden="true">↗</span></Link>
            </div>
            <p className="landing-hero-footnote landing-enter">A quick update. Fewer check-ins. More room to work.</p>
          </div>
          <HeroBoard />
        </section>
        <div className="landing-hero-end"><a href="#how-it-works"><span className="landing-scroll-icon" aria-hidden="true">↓</span>Follow the workday</a><span className="landing-hero-end-note"><i aria-hidden="true" /> Updated live, all day</span></div>

        <ScrollStory />

        <RevealSection className="landing-closing" labelledBy="landing-closing-title">
          <div className="landing-closing-mark" aria-hidden="true"><Wordmark size={38} /></div>
          <p className="public-overline">Your next workday, a little clearer</p>
          <h2 id="landing-closing-title">Together on the big picture.<br /><span>Free to focus on your part.</span></h2>
          <p>Give your team one place to see what&rsquo;s happening.<br className="landing-desktop-break" /> Then make room for the work that matters.</p>
          <Link href="/signup" className="btn landing-closing-cta">Create your workspace <Icon name="arrow" width="19" height="19" /></Link>
          <span className="landing-closing-note">Start a team or join one with a code.</span>
        </RevealSection>
      </main>

      <footer className="public-footer">
        <div className="public-wordmark"><Wordmark size={23} /></div>
        <p>A little more clarity in your workday.</p>
        <nav aria-label="Footer navigation"><Link href="/login">Sign in</Link><Link href="/signup">Create account</Link></nav>
      </footer>
    </LandingExperience>
  );
}
