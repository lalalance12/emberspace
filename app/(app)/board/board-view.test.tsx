import type { ReactNode } from "react";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BoardView } from "./board-view";
import type { NoteStatus } from "@/components/status-note";

const realtime = vi.hoisted(() => ({
  callbacks: new Map<string, (payload: { new: NoteStatus }) => void>(),
  subscriptions: new Map<string, (status: string) => void>(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: (name: string) => {
      const channel = {
        on: (_event: string, _filter: unknown, callback: (payload: { new: NoteStatus }) => void) => {
          realtime.callbacks.set(name, callback);
          return channel;
        },
        subscribe: (callback?: (status: string) => void) => { if (callback) realtime.subscriptions.set(name, callback); return channel; },
        presenceState: () => ({}),
      };
      return channel;
    },
    removeChannel: vi.fn(),
  }),
}));

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
  return render(<BoardView teamId="team" viewerId="alex" members={members} initialStatuses={[
    status("alex", "working", "Building the account screen", "APP-42"),
    status("sam", "blocked", "Waiting for design assets"),
  ]} initialNudges={[]} serverNow={Date.now()} />);
}

beforeEach(() => { realtime.callbacks.clear(); realtime.subscriptions.clear(); });
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

    act(() => realtime.callbacks.get("board-statuses:team")?.({ new: status("jo", "blocked", "Need access to the staging server") }));
    expect(screen.getAllByTestId("status-note")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Blocked 2" })).toHaveAttribute("aria-pressed", "true");

    act(() => realtime.callbacks.get("board-statuses:team")?.({ new: status("sam", "working", "Assets are ready") }));
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
    act(() => realtime.callbacks.get("board-statuses:team")?.({ new: { ...status("jo", "working", "Newest work"), started_at: new Date(Date.now() + 1000).toISOString() } }));
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
    act(() => realtime.subscriptions.get("board-statuses:team")?.("SUBSCRIBED"));
    expect(screen.getByText("Live updates")).toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "Open Sam Chen's status" });
    trigger.focus();
    act(() => realtime.callbacks.get("board-statuses:team")?.({ new: status("sam", "working", "Access restored") }));
    expect(trigger).toHaveFocus();
    expect(screen.getByText("Sam Chen updated their status")).toBeInTheDocument();
    act(() => realtime.subscriptions.get("board-statuses:team")?.("CHANNEL_ERROR"));
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
    act(() => realtime.callbacks.get("board-statuses:team")?.({ new: status("sam", "working", "Unblocked") }));
    expect(screen.getByRole("button", { name: "Blocked 0" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("No matching updates")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Blocked 0" }));
    expect(screen.getAllByTestId("status-note")).toHaveLength(2);
  });
});
