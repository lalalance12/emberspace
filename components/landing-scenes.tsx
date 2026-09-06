"use client";

import { createContext, useContext, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import {
  motion, useMotionValue, useMotionValueEvent, useReducedMotion,
  useScroll, useSpring, useTransform,
} from "motion/react";

import { BrandMark } from "@/components/brand-mark";
import { Icon } from "@/components/ui/icon";

type MotionPreference = "system" | "full" | "reduced";
const MotionPreferenceContext = createContext<{
  reduced: boolean;
  preference: MotionPreference;
  setPreference: (value: MotionPreference) => void;
}>({
  reduced: false,
  preference: "system" as MotionPreference,
  setPreference: () => {},
});

export function LandingExperience({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<MotionPreference>("system");
  const [mounted, setMounted] = useState(false);
  const deviceReduced = useReducedMotion();
  const reduced = preference === "reduced" || (preference === "system" && Boolean(deviceReduced));
  // Keep the first client render identical to the server; CSS handles the device
  // preference before hydration. An explicit choice lasts only for this visit.
  useEffect(() => setMounted(true), []);

  return <MotionPreferenceContext.Provider value={{ reduced, preference, setPreference }}><div className="public-site landing-experience" data-motion={mounted ? reduced ? "reduced" : "full" : "system"}>{children}</div></MotionPreferenceContext.Provider>;
}

export function MotionPreferenceControl() {
  const { preference, setPreference } = useContext(MotionPreferenceContext);
  return <label className="landing-motion-control"><Icon name="settings" width="14" height="14" /><span>Motion</span><select aria-label="Motion preference" value={preference} onChange={(event) => setPreference(event.target.value as MotionPreference)}><option value="system">Device setting</option><option value="full">Full motion</option><option value="reduced">Reduced motion</option></select></label>;
}

const exampleNotes = [
  { name: "Dana", state: "working", label: "Working", note: "Making checkout feel effortless", ticket: "WS-118", age: "18m ago" },
  { name: "Ravi", state: "blocked", label: "Blocked", note: "Waiting on the staging key", ticket: "WS-121", age: "1h ago" },
  { name: "Mei", state: "reviewing", label: "Reviewing", note: "A second pair of eyes on the release", ticket: "WS-104", age: "35m ago" },
  { name: "Alex", state: "break", label: "On a break", note: "A walk, then back to the little details", ticket: "Back soon", age: "15m ago" },
] as const;

/** CSS depth with a small pointer-driven tilt; no render loop or WebGL bundle. */
export function HeroBoard() {
  const [later, setLater] = useState(false);
  const { reduced: reduceMotion } = useContext(MotionPreferenceContext);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const rotateX = useSpring(pointerY, { stiffness: 120, damping: 22 });
  const rotateY = useSpring(pointerX, { stiffness: 120, damping: 22 });

  function tilt(event: PointerEvent<HTMLDivElement>) {
    if (reduceMotion || event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set(((event.clientX - rect.left) / rect.width - 0.5) * 10);
    pointerY.set(((event.clientY - rect.top) / rect.height - 0.5) * -8);
  }

  function resetTilt() {
    pointerX.set(0);
    pointerY.set(0);
  }

  return (
    <figure className="landing-board-figure">
      <div className="landing-board-stage" onPointerMove={tilt} onPointerLeave={resetTilt}>
        <div className="landing-board-shadow" aria-hidden="true" />
        <motion.div className="landing-board-tilt" style={{ rotateX, rotateY }}>
          <div className="landing-board-object" data-aged={later}>
            <div className="landing-board-backing" aria-hidden="true" />
            <div className="landing-board-face">
              <div className="landing-model-header">
                <span className="landing-model-brand"><BrandMark size={23} /> Product team</span>
                <span className="landing-model-example">Example board</span>
              </div>
              <div className="landing-model-title"><h2>Today, together.</h2><span>4 teammates</span></div>
              <div className="landing-model-notes">
                {exampleNotes.map((note) => (
                  <div className="landing-model-note" data-state={note.state} key={note.name}>
                    <div className="landing-model-person"><span>{note.name[0]}</span><strong>{note.name}</strong><span className="landing-model-state">{note.label}</span></div>
                    <p>{note.note}</p>
                    <div className="landing-model-meta"><span>{note.ticket}</span><span>{later ? note.state === "blocked" ? "7h ago" : "Stale · 7h" : note.age}</span></div>
                  </div>
                ))}
              </div>
              <div className="landing-model-footer"><span><i /> A little more clarity.</span><span>A little less catching up.</span></div>
            </div>
            <div className="landing-board-signal"><span className="landing-signal-icon"><Icon name="team" width="17" height="17" /></span><div><strong>One shared picture</strong><span>Everyone has room to focus.</span></div></div>
          </div>
        </motion.div>
      </div>
      <figcaption className="landing-demo-controls">
        <div className="landing-demo-toggle" role="group" aria-label="Preview the board over time">
          <button type="button" aria-pressed={!later} onClick={() => setLater(false)}>Right now</button>
          <button type="button" aria-pressed={later} onClick={() => setLater(true)}>7 hours later <Icon name="arrow" width="14" height="14" /></button>
        </div>
        <p role="status">{later ? "Older updates fade. Ravi’s blocker stays visible." : "A living board. Try moving time forward."}</p>
      </figcaption>
    </figure>
  );
}

const chapters = [
  { number: "01", label: "Share a little", title: "A quick update.\nThen back to it.", body: "Pick a status, add a short note, and let your team know what’s on your plate. Your work gets the rest of your attention.", detail: "Working · Reviewing · On a break", icon: "edit" },
  { number: "02", label: "Let time do its thing", title: "Fresh stands out.\nOlder fades away.", body: "Your board changes as the day moves on. Colour gently fades from older updates, so it’s easy to tell what’s current without reading every timestamp.", detail: "An honest picture of right now", icon: "timeline" },
  { number: "03", label: "Make room for a little help", title: "Some things\nneed to stay seen.", body: "Blockers keep their colour. Send a gentle nudge when someone needs your attention, then continue the conversation in the tools you already use.", detail: "A signal that stays in sight", icon: "team" },
] as const;

export function ScrollStory() {
  const storyRef = useRef<HTMLDivElement>(null);
  const [chapter, setChapter] = useState(0);
  const { scrollYProgress } = useScroll({ target: storyRef, offset: ["start center", "end center"] });
  const rotation = useTransform(scrollYProgress, [0, 0.34, 0.66, 1], [-12, -5, 4, 8]);
  const tilt = useTransform(scrollYProgress, [0, 0.5, 1], [13, 4, -5]);
  const topX = useTransform(scrollYProgress, [0, 0.4, 0.66, 0.85], [0, -12, -50, -82]);
  const topY = useTransform(scrollYProgress, [0, 0.4, 0.66, 0.85], [0, -8, -35, -48]);
  const backX = useTransform(scrollYProgress, [0, 0.4, 0.66, 0.85], [24, 28, 40, 48]);
  const backY = useTransform(scrollYProgress, [0, 0.4, 0.66, 0.85], [28, 32, 42, 50]);
  const frontDepth = useTransform(scrollYProgress, [0, 0.62, 0.76], [40, 40, 0]);
  const backDepth = useTransform(scrollYProgress, [0, 0.62, 0.76], [0, 0, 60]);
  const tint = useTransform(scrollYProgress, [0, 0.28, 0.55], [1, 1, 0.035]);

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const next = value < 1 / 3 ? 0 : value < 2 / 3 ? 1 : 2;
    setChapter((current) => current === next ? current : next);
  });

  return (
    <section id="how-it-works" className="landing-story" aria-labelledby="landing-story-title">
      <div className="landing-story-heading">
        <p className="public-overline">Less checking in. More getting on.</p>
        <h2 id="landing-story-title">The workday moves.<br /><span>Your board keeps up.</span></h2>
        <p>A small habit that keeps the whole team in the picture.</p>
      </div>
      <div ref={storyRef} className="landing-story-layout" data-chapter={chapter}>
        <div className="landing-story-chapters">
          {chapters.map((item, index) => (
            <article className="landing-chapter" id={`story-${index + 1}`} key={item.number}>
              <div className="landing-chapter-copy">
                <p className="landing-chapter-label"><span>{item.number}</span>{item.label}</p>
                <h3>{item.title.split("\n").map((line) => <span key={line}>{line}</span>)}</h3>
                <p className="landing-chapter-body">{item.body}</p>
                <p className="landing-chapter-detail"><Icon name={item.icon} width="17" height="17" />{item.detail}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="landing-story-sticky">
          <div className="landing-story-theatre">
            <div className="landing-theatre-header"><span><i /> The life of an update</span><span>Example</span></div>
            <div className="landing-stack-stage" aria-hidden="true">
              <div className="landing-stack-orbit" />
              <motion.div className="landing-note-stack" style={{ rotateZ: rotation, rotateX: tilt }}>
                <motion.div className="landing-stack-note landing-stack-blocked" style={{ x: backX, y: backY, z: backDepth }}>
                  <div className="landing-stack-person"><span>R</span><strong>Ravi</strong><span className="landing-stack-status">Blocked</span></div>
                  <p>Waiting on the<br />staging key</p>
                  <div className="landing-stack-meta"><span>WS-121</span><span>Still needs a hand</span></div>
                  <div className="landing-stack-bottom"><Icon name="team" width="16" height="16" /><span>A blocker never fades.</span></div>
                </motion.div>
                <motion.div className="landing-stack-note landing-stack-working" style={{ x: topX, y: topY, z: frontDepth }}>
                  <motion.div className="landing-stack-tint" style={{ opacity: tint }} />
                  <div className="landing-stack-person"><span>D</span><strong>Dana</strong><span className="landing-stack-status">Working</span></div>
                  <p>Making checkout<br />feel effortless</p>
                  <div className="landing-stack-meta"><span>WS-118</span><span>{chapter === 0 ? "Just posted" : "Stale · 7h"}</span></div>
                  <div className="landing-stack-bottom"><span className="landing-note-line" /><span>{chapter === 0 ? "Fresh and in focus" : "Room for what’s next"}</span></div>
                </motion.div>
              </motion.div>
            </div>
            <div className="landing-theatre-caption" aria-hidden="true">
              <span className="landing-theatre-time">{["09:00", "16:00", "Still visible"][chapter]}</span>
              <p>{["A little context goes a long way.", "Time passes. The signal gets quieter.", "The right things hold your attention."][chapter]}</p>
            </div>
            <div className="landing-story-progress" aria-hidden="true"><motion.span style={{ scaleX: scrollYProgress }} /></div>
          </div>
          <nav className="landing-chapter-nav" aria-label="How it works chapters">
            {chapters.map((item, index) => <a key={item.number} href={`#story-${index + 1}`} aria-current={chapter === index ? "step" : undefined}><span>{item.number}</span>{["Post", "Let it settle", "Notice"][index]}</a>)}
          </nav>
        </div>
      </div>
    </section>
  );
}
