"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { presentationFor, type StatusState } from "@/lib/status-state";

/**
 * The picture on the right of sign-in and sign-up. Same frame on both pages, a
 * different story in each:
 *
 *   - Sign in is the board you are coming back to. It is already running, and
 *     updates keep landing on top while Ravi's blocker holds the bottom row —
 *     the one card that never drains.
 *   - Sign up is the board you are about to make. It starts empty, you post the
 *     first update, the join code goes out, and teammates arrive one by one.
 *
 * Both are scripts, not data. Nothing here reads the database; the names are
 * the same cast the landing page uses, so the three pages tell one story.
 */
export type AuthBoardVariant = "signin" | "signup";

interface Row {
  id: string;
  name: string;
  state: StatusState;
  note: string;
  /** The tick it was posted on; age is counted from here. */
  postedAt: number;
}

const TICK_MS = { signin: 3200, signup: 2400 } as const;

const feed: Array<Omit<Row, "id" | "postedAt">> = [
  { name: "Alex", state: "working", note: "Picking up the onboarding copy" },
  { name: "Mei", state: "reviewing", note: "Reading the migration diff" },
  { name: "Dana", state: "in_meeting", note: "Planning with design until 3" },
  { name: "Sam", state: "break", note: "Coffee, back in ten" },
  { name: "Lance", state: "working", note: "Shipping the retry fix" },
];

const blocker: Row = { id: "ravi", name: "Ravi", state: "blocked", note: "Waiting on the staging key", postedAt: -15 };

const arrivals: Array<Omit<Row, "id" | "postedAt">> = [
  { name: "You", state: "working", note: "Setting up our board" },
  { name: "Dana", state: "working", note: "Rewriting the checkout retry" },
  { name: "Mei", state: "reviewing", note: "Reading the migration diff" },
];

/** Sign-up beats: 0 empty, 1 you post, 2 code shared, 3–4 teammates, 5–6 hold. */
const SIGNUP_STEPS = 7;

function signinRows(tick: number): Row[] {
  // The two newest updates sit on top; the blocker is pinned underneath.
  const top = [tick, tick - 1].map((t) => {
    const entry = feed[((t % feed.length) + feed.length) % feed.length];
    return { ...entry, id: `feed-${t}`, postedAt: t };
  });
  return [...top, blocker];
}

function signupRows(step: number): Row[] {
  const posted = step >= 4 ? 3 : step >= 3 ? 2 : step >= 1 ? 1 : 0;
  // Newest first, the way the real board pins them.
  return arrivals.slice(0, posted).map((entry, i) => ({ ...entry, id: `arrival-${i}`, postedAt: [1, 3, 4][i] })).reverse();
}

function ageLabel(tick: number, postedAt: number, state: StatusState): string {
  const minutes = (tick - postedAt) * 4;
  if (state === "blocked") return "1H";
  return minutes <= 0 ? "NOW" : `${minutes}M`;
}

export function AuthBoard({ variant }: { variant: AuthBoardVariant }) {
  const [tick, setTick] = useState(1);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), TICK_MS[variant]);
    return () => window.clearInterval(id);
  }, [variant]);

  const step = variant === "signup" ? (tick - 1) % SIGNUP_STEPS : 0;
  const rows = variant === "signin" ? signinRows(tick) : signupRows(step);
  const members = variant === "signup" ? Math.max(1, rows.length) : 5;
  const now = variant === "signin" ? tick : [0, 1, 1, 3, 4, 5, 6][step];

  // Rows enter from above and leave by shrinking away; layout springs carry
  // the others into their new slots. Under reduced motion only opacity moves.
  const enter = reduceMotion ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.97 };
  const exit = reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 };

  return (
    <div className="public-auth-demo auth-board" data-variant={variant}>
      <div className="public-auth-demo-header">
        <div>
          <strong>{variant === "signin" ? "Team board" : "Your new board"}</strong>
          <span className="auth-board-sub">{variant === "signin" ? "Product team" : `${members} ${members === 1 ? "member" : "members"}`}</span>
        </div>
        {variant === "signin" ? (
          <span className="auth-board-live"><i aria-hidden="true" /> Live</span>
        ) : (
          <span className="auth-board-code" data-shared={step >= 2}>
            <span>Join code</span>K7QM4XPA
          </span>
        )}
      </div>

      <div className="public-compact-demo auth-board-list">
        <AnimatePresence initial={false} mode="popLayout">
          {rows.length === 0 && (
            <motion.p key="empty" className="auth-board-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              Nothing pinned yet. Post the first update.
            </motion.p>
          )}
          {rows.map((row) => {
            const look = presentationFor(row.state);
            const fresh = row.postedAt === now && row.state !== "blocked";
            return (
              <motion.div
                key={row.id}
                layout={reduceMotion ? false : "position"}
                className="public-compact-row"
                data-state={row.state}
                data-fresh={fresh}
                style={{ "--demo-state": look.accent } as CSSProperties}
                initial={enter}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={exit}
                transition={{ layout: { type: "spring", duration: 0.5, bounce: 0.2 }, default: { duration: 0.35, ease: [0.23, 1, 0.32, 1] } }}
              >
                <span className="public-compact-avatar" aria-hidden="true">{row.name.slice(0, 1)}</span>
                <div className="public-compact-person">
                  <div><strong>{row.name}</strong><span>{look.label}</span></div>
                  <p>{row.note}</p>
                </div>
                <span className="public-compact-age">{ageLabel(now, row.postedAt, row.state)}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
