"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { RpcError, acknowledgeNudge } from "@/lib/rpc";
import { createClient } from "@/lib/data-client";

export interface PeerNudge {
  id: string;
  recipient_id: string;
  sender_id: string | null;
  note: string | null;
  link: string | null;
  created_at: string;
}

/**
 * "Someone wants you" — shown at the top of the board when a peer nudge is
 * open against you.
 *
 * Two actions and no third: go to the conversation, or acknowledge that you saw
 * it. Acknowledging notifies the sender so they know to expect you, which is the
 * point of a nudge closing the loop rather than evaporating.
 *
 * The caller passes the LATEST open nudge only. Peer nudges stack by design, but
 * a stack of banners turns the board into an inbox — the one thing this product
 * refuses to be. Anything older is counted here and read in the bell, where a
 * list belongs.
 */
export function NudgeBanner({
  nudges,
  olderCount = 0,
  nameFor,
  onAcknowledged,
}: {
  nudges: PeerNudge[];
  olderCount?: number;
  nameFor: (id: string | null) => string;
  onAcknowledged: (id: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  // Leaves the way it arrived: rising in, settling back down on acknowledge,
  // so answering a nudge reads as the banner being put away, not deleted.
  // Under reduced motion only the fade remains.
  const offset = reduceMotion ? "translateY(0px)" : "translateY(8px)";

  return (
    <AnimatePresence initial={false}>
      {nudges.length > 0 && (
        <motion.div
          key="nudges"
          className="mb-6 flex flex-col gap-2"
          initial={{ opacity: 0, transform: offset }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          exit={{ opacity: 0, transform: offset, transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] } }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        >
          {nudges.map((nudge) => (
            <NudgeRow
              key={nudge.id}
              nudge={nudge}
              sender={nameFor(nudge.sender_id)}
              onAcknowledged={onAcknowledged}
            />
          ))}

          {olderCount > 0 && (
            <p className="annotation pl-1">
              {olderCount} earlier nudge{olderCount === 1 ? "" : "s"} — see the bell
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NudgeRow({
  nudge,
  sender,
  onAcknowledged,
}: {
  nudge: PeerNudge;
  sender: string;
  onAcknowledged: (id: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function acknowledge() {
    setError(null);
    setPending(true);
    try {
      await acknowledgeNudge(createClient(), nudge.id);
      onAcknowledged(nudge.id);
    } catch (err) {
      setPending(false);
      setError(
        err instanceof RpcError ? err.message : "That didn't go through.",
      );
    }
  }

  return (
    <div
      className="flex flex-wrap items-center gap-3 border p-4"
      style={{
        borderRadius: "var(--radius-card)",
        borderColor: "color-mix(in oklab, var(--violet) 35%, transparent)",
        backgroundImage:
          "linear-gradient(120deg, color-mix(in oklab, var(--violet) 12%, var(--surface)) 0%, var(--surface) 70%)",
      }}
    >
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundImage: "var(--gradient-brand)" }}
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{sender} nudged you</p>
        <p className="mt-0.5 text-sm text-[var(--ink-soft)]">
          {nudge.note ?? "Check your messages."}
        </p>
        {error && <p className="mt-1 text-sm text-[var(--signal)]">{error}</p>}
      </div>

      <div className="flex shrink-0 gap-2">
        {nudge.link && (
          <a
            href={nudge.link}
            target="_blank"
            rel="noreferrer noopener"
            className="btn btn-quiet"
            onClick={() => void acknowledge()}
          >
            Open messages
          </a>
        )}
        <Button type="button" onClick={() => void acknowledge()} disabled={pending}>
          {pending ? "…" : "Got it"}
        </Button>
      </div>
    </div>
  );
}
