import type { ReactNode } from "react";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BoardView } from "./board-view";
import type { NoteStatus } from "@/components/status-note";

/**
 * The board polls a snapshot rather than subscribing to a stream. These mocks
 * capture its poll callback so a test can deliver "the next refresh" on
 * demand: post() changes what the server would return and runs one poll.
 */
const live = vi.hoisted(() => ({
  tick: null as null | (() => Promise<void> | void),
  statuses: new Map<string, NoteStatus>(),
  failing: false,
}));

vi.mock("@/lib/use-poll", () => ({
  usePoll: (tick: () => Promise<void> | void) => { live.tick = tick; },
}));

vi.mock("@/app/live-actions", () => ({
  getBoardSnapshot: async () => {
    if (live.failing) throw new Error("offline");
    return { statuses: [...live.statuses.values()], nudges: [], online: [] };
  },
}));

// The nudge banner and composer reach the server through this; the board's
// filtering never calls it.
vi.mock("@/lib/data-client", () => ({ createClient: () => ({}) }));

async function poll() {
  await act(async () => { await live.tick?.(); });
}

async function post(next: NoteStatus) {
  live.statuses.set(next.profile_id, next);
  await poll();
}

// Layout animation is independent of the filtering and live-data behavior.
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  LayoutGroup: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
    span: ({ children, className }: { children?: ReactNode; className?: string }) => <span className={className}>{children}</span>,
  },
  useReducedMotion: () => true,
}));

const members = [
  { id: "alex", display_name: "Alex Rivera" },
  { id: "sam", display_name: "Sam Chen" },
  { id: "jo", display_name: "Jo Lee" },
];

function status(profile_id: string, state: string, note: string, ticket_ref: string | null = null): NoteStatus {
  return { id: `${profile_id}-${state}`, profile_id, state, note, ticket_ref, duration_minutes: null, started_at: new Date().toISOString() };
}

function renderBoard() {
  const initial = [
    status("alex", "working", "Building the account screen", "APP-42"),
    status("sam", "blocked", "Waiting for design assets"),
  ];
  live.statuses = new Map(initial.map((s) => [s.profile_id, s]));
  return render(<BoardView teamId="team" viewerId="alex" members={members} initialStatuses={initial} initialNudges={[]} serverNow={Date.now()} />);
}

beforeEach(() => { live.tick = null; live.failing = false; });
afterEach(cleanup);

describe("Board search and status filters", () => {
  it("searches people and tickets, combines with a status filter, and clears the empty view", async () => {
    const user = userEvent.setup();
    renderBoard();
    const search = screen.getByRole("searchbox", { name: "Search people or updates" });

    await user.type(search, "app-42");
    expect(screen.getAllByTestId("status-note")).toHaveLength(1);
    expect(screen.getByTestId("status-note")).toHaveAttribute("data-profile-id", "alex");

    await user.clear(search);
    await user.type(search, "SAM");
    expect(screen.getByTestId("status-note")).toHaveAttribute("data-profile-id", "sam");
    await user.click(screen.getByRole("button", { name: "Working 1" }));
    expect(screen.getByText("No matching updates")).toBeInTheDocument();
    expect(screen.queryByTestId("status-note")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(search).toHaveValue("");
    expect(screen.getAllByTestId("status-note")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "All updates 2" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps a selected filter live as teammates post and moves them out of the check-in list", async () => {
    const user = userEvent.setup();
    renderBoard();
    expect(screen.getByRole("region", { name: "Teammates without an update" })).toHaveTextContent("Jo Lee");
    await user.click(screen.getByRole("button", { name: "Blocked 1" }));
    expect(screen.getAllByTestId("status-note")).toHaveLength(1);

    await post(status("jo", "blocked", "Need access to the staging server"));
    expect(screen.getAllByTestId("status-note")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Blocked 2" })).toHaveAttribute("aria-pressed", "true");

    await post(status("sam", "working", "Assets are ready"));
    expect(screen.getAllByTestId("status-note")).toHaveLength(1);
    expect(screen.getByTestId("status-note")).toHaveAttribute("data-profile-id", "jo");
    expect(within(screen.getByTestId("status-note")).getByRole("button", { name: "Nudge Jo Lee" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "All updates 3" }));
    expect(screen.getAllByTestId("status-note")).toHaveLength(3);
    expect(screen.queryByRole("region", { name: "Teammates without an update" })).not.toBeInTheDocument();
  });

  it("prioritizes blockers and sorts recent updates without dropping a search", async () => {
    const user = userEvent.setup();
    renderBoard();
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort updates" }), "attention");
    expect(screen.getAllByTestId("status-note")[0]).toHaveAttribute("data-profile-id", "sam");
    await post({ ...status("jo", "working", "Newest work"), started_at: new Date(Date.now() + 1000).toISOString() });
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort updates" }), "latest");
    expect(screen.getAllByTestId("status-note")[0]).toHaveAttribute("data-profile-id", "jo");
    await user.type(screen.getByRole("searchbox"), "assets");
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort updates" }), "name");
    expect(screen.getAllByTestId("status-note")).toHaveLength(1);
    expect(screen.getByTestId("status-note")).toHaveAttribute("data-profile-id", "sam");
  });

  it("reports connection changes and keeps keyboard focus when a card updates", async () => {
    const user = userEvent.setup();
    renderBoard();
    expect(screen.getByText("Connecting…")).toBeInTheDocument();
    await poll();
    expect(screen.getByText("Live updates")).toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "Open Sam Chen's status" });
    trigger.focus();
    await post(status("sam", "working", "Access restored"));
    expect(trigger).toHaveFocus();
    expect(screen.getByText("Sam Chen updated their status")).toBeInTheDocument();
    live.failing = true;
    await poll();
    expect(screen.getByText("Reconnecting…")).toBeInTheDocument();
    expect(screen.getAllByTestId("status-note")).toHaveLength(2);
    await user.type(screen.getByRole("searchbox"), "no-match");
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("searchbox")).toHaveFocus();
  });

  it("retains the selected chip when its last matching teammate changes status", async () => {
    const user = userEvent.setup();
    renderBoard();
    await user.click(screen.getByRole("button", { name: "Blocked 1" }));
    await post(status("sam", "working", "Unblocked"));
    expect(screen.getByRole("button", { name: "Blocked 0" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("No matching updates")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Blocked 0" }));
    expect(screen.getAllByTestId("status-note")).toHaveLength(2);
  });
});
