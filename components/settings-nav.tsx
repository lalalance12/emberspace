import Link from "next/link";

export function SettingsNav({ current }: { current: "me" | "team" }) {
  return (
    <nav className="settings-tabs" aria-label="Settings">
      <Link href="/settings/me" aria-current={current === "me" ? "page" : undefined}>
        Personal
      </Link>
      <Link href="/settings/team" aria-current={current === "team" ? "page" : undefined}>
        Team
      </Link>
    </nav>
  );
}
