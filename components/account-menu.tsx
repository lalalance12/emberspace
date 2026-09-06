"use client";

import { useState } from "react";
import Link from "next/link";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * The account chip, and what is behind it.
 *
 * The chip used to be a bare link to /settings/me, which left sign-out with
 * nowhere to live — there was no way out of the app at all short of clearing
 * cookies. A menu is the conventional place people look for it, and it costs
 * the same one click the link did.
 *
 * Sign out is a real form posting to a route handler, not an onClick. It works
 * with JavaScript disabled, the browser shows it as a genuine navigation, and
 * the session cookies are cleared by the server in the response that redirects
 * — see app/auth/signout/route.ts for why that ordering matters.
 */
export function AccountMenu({
  displayName,
  isHead,
}: {
  displayName: string;
  isHead: boolean;
}) {
  const [open, setOpen] = useState(false);
  const initial = displayName.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Account: ${displayName}`}
          className="account-trigger flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 text-sm transition-colors duration-200 hover:bg-[var(--sunken)]"
        >
          <span
            aria-hidden="true"
            className="account-avatar grid size-9 place-items-center rounded-full text-sm font-semibold"
          >
            {initial}
          </span>
          <span className="hidden max-w-40 truncate text-left sm:inline">{displayName}</span>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m5 8 5 5 5-5" /></svg>
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-56 p-1.5">
        <div className="px-2.5 pt-1.5 pb-2">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <p className="annotation mt-0.5">
            {isHead ? "Team head" : "Member"}
          </p>
        </div>

        <div
          className="my-1 border-t"
          style={{ borderColor: "var(--line)" }}
          aria-hidden="true"
        />

        <Link
          href="/settings/me"
          onClick={() => setOpen(false)}
          className="block rounded-[var(--radius-control)] px-2.5 py-2 text-sm transition-colors duration-150 hover:bg-[var(--sunken)]"
        >
          Your settings
        </Link>
        <Link
          href="/settings/team"
          onClick={() => setOpen(false)}
          className="block rounded-[var(--radius-control)] px-2.5 py-2 text-sm transition-colors duration-150 hover:bg-[var(--sunken)]"
        >
          Team
        </Link>

        <div
          className="my-1 border-t"
          style={{ borderColor: "var(--line)" }}
          aria-hidden="true"
        />

        <form method="post" action="/auth/signout">
          <button
            type="submit"
            data-testid="sign-out"
            className="w-full rounded-[var(--radius-control)] px-2.5 py-2 text-left text-sm text-[var(--signal)] transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--signal)_10%,transparent)]"
          >
            Sign out
          </button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
