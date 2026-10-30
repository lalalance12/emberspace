import type { SVGProps } from "react";

/**
 * What someone is doing, as a glyph. Colour on a card means attention
 * (lib/status-state.ts, heatFor), so the activity needs its own channel — this
 * one, next to the label, in the card's ink.
 */
const PATHS: Record<string, React.ReactNode> = {
  working: <path d="M3 12 9.5 5.5M8 4l4 4M10.5 2.5l3 3" />,
  reviewing: <><circle cx="7" cy="7" r="4" /><path d="m10 10 3.5 3.5" /></>,
  blocked: <><circle cx="8" cy="8" r="5.5" /><path d="M4.2 11.8 11.8 4.2" /></>,
  in_meeting: <><circle cx="5.5" cy="6" r="2" /><circle cx="10.5" cy="6" r="2" /><path d="M2 13c.5-2 2-3 3.5-3s3 1 3.5 3M7 13c.5-2 2-3 3.5-3s3 1 3.5 3" /></>,
  break: <path d="M3 6h8v4a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM11 7h1.5a1.5 1.5 0 0 1 0 3H11M6 2.5v1.5M8.5 2.5v1.5" />,
  done_for_day: <path d="M8 3v5M5 4.5a4.5 4.5 0 1 0 6 0" />,
  off: <path d="M12.5 9.5A5 5 0 1 1 6.5 3.5a4 4 0 0 0 6 6Z" />,
  other: <><circle cx="4" cy="8" r="1" /><circle cx="8" cy="8" r="1" /><circle cx="12" cy="8" r="1" /></>,
};

export function StateIcon({ state, ...props }: SVGProps<SVGSVGElement> & { state: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {PATHS[state] ?? PATHS.working}
    </svg>
  );
}
