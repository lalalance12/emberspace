"use client";

import { useEffect, useRef } from "react";

/**
 * Run `tick` every `intervalMs` while the tab is visible, and once straight
 * away whenever it becomes visible again.
 *
 * Hidden tabs do not poll. A board left open in a background tab all day would
 * otherwise keep the database awake around the clock for nobody — and the
 * moment someone looks again, the immediate tick catches them up.
 *
 * `tick` may change between renders; the latest one is always the one called.
 */
export function usePoll(tick: () => Promise<void> | void, intervalMs: number) {
  const latest = useRef(tick);
  latest.current = tick;

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let running = false;

    const run = async () => {
      // Never stack polls: a slow response simply skips the next beat.
      if (running) return;
      running = true;
      try {
        await latest.current();
      } finally {
        running = false;
      }
    };

    const start = () => {
      stop();
      if (document.visibilityState !== "visible") return;
      void run();
      timer = setInterval(() => void run(), intervalMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };

    start();
    document.addEventListener("visibilitychange", start);
    return () => {
      document.removeEventListener("visibilitychange", start);
      stop();
    };
  }, [intervalMs]);
}
