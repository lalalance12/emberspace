/**
 * Status states and how they read on a card.
 *
 * The enum here must stay in step with public.status_state in
 * db/migrations/20260805090000_extensions_and_types.sql. Update
 * lib/database.types.ts after any migration.
 *
 * Colour is attention, not activity. Every state maps to one of three heats —
 * glowing (violet, with a yellow core while fresh), burning (blocked, red) or
 * resting (break, done, off: quiet grey) — and its --state token resolves to
 * that heat's colour. What someone is doing is carried by the label and its
 * icon (components/state-icon.tsx), never by a hue of its own.
 */

export const STATUS_STATES = [
  "working",
  "reviewing",
  "blocked",
  "in_meeting",
  "break",
  "done_for_day",
  "off",
  "other",
] as const;

export type StatusState = (typeof STATUS_STATES)[number];

interface StatePresentation {
  /** Button/label text. Plain and specific. */
  label: string;
  /** The state's single colour token. Drives tint, edge, dot and glow. */
  accent: string;
  /** Ink to use when the accent is painted as a solid fill. */
  onAccent: string;
  /** Signed-off states sit quiet; they are finished, not stale. */
  muted: boolean;
}

export const STATE_PRESENTATION: Record<StatusState, StatePresentation> = {
  working: {
    label: "Working",
    accent: "var(--color-state-working)",
    onAccent: "white",
    muted: false,
  },
  reviewing: {
    label: "Reviewing",
    accent: "var(--color-state-reviewing)",
    onAccent: "white",
    muted: false,
  },
  blocked: {
    // The only state that holds full chroma at any age.
    label: "Blocked",
    accent: "var(--color-state-blocked)",
    onAccent: "white",
    muted: false,
  },
  in_meeting: {
    label: "In a meeting",
    accent: "var(--color-state-meeting)",
    onAccent: "var(--ink)",
    muted: false,
  },
  break: {
    label: "On a break",
    accent: "var(--color-state-break)",
    onAccent: "var(--ink)",
    muted: false,
  },
  done_for_day: {
    label: "Done for the day",
    accent: "var(--color-state-off)",
    onAccent: "white",
    muted: true,
  },
  off: {
    label: "Off",
    accent: "var(--color-state-off)",
    onAccent: "white",
    muted: true,
  },
  // The escape hatch. The card shows the person's own words (custom_label)
  // in place of this generic label whenever one is set.
  other: {
    label: "Other",
    accent: "var(--color-state-other)",
    onAccent: "white",
    muted: false,
  },
};

export function presentationFor(state: string): StatePresentation {
  return STATE_PRESENTATION[state as StatusState] ?? STATE_PRESENTATION.working;
}

/** How much attention a status asks for. Drives the board's bands and the card's colour. */
export type Heat = "burning" | "glowing" | "resting";

/** Away rather than stale: these never glow and never decay-shame. */
const RESTING_STATES = new Set<string>(["break", "done_for_day", "off"]);

export function heatFor(state: string): Heat {
  if (state === "blocked") return "burning";
  if (RESTING_STATES.has(state)) return "resting";
  return "glowing";
}
