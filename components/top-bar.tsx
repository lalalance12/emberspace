import Link from "next/link";

import { AccountMenu } from "@/components/account-menu";
import { Wordmark } from "@/components/brand-mark";
import { NavLinks, type NavItem } from "@/components/nav-links";
import { NotificationBell } from "@/components/notification-bell";
import { Icon } from "@/components/ui/icon";

// The office route stays off navigation until its floor plan is ready.
const NAV: NavItem[] = [
  { href: "/board", label: "Board", icon: "board" },
  { href: "/me", label: "My status", icon: "edit" },
  { href: "/timeline", label: "Timeline", icon: "timeline" },
];
const SETTINGS: NavItem[] = [
  { href: "/settings/team", label: "Team", icon: "team" },
  { href: "/settings/me", label: "Settings", icon: "settings" },
];

export function TopBar({ profileId, displayName, isHead }: {
  profileId: string;
  displayName: string;
  isHead: boolean;
}) {
  return (
    <>
      <aside className="app-sidebar">
        <Link href="/board" className="sidebar-brand" aria-label="Workspace board">
          <Wordmark size={32} />
        </Link>
        <div className="sidebar-navigation">
          <p className="sidebar-label">Your workspace</p>
          <NavLinks items={NAV} label="Workspace" />
          <p className="sidebar-label sidebar-label-manage">Manage</p>
          <NavLinks items={SETTINGS} label="Manage workspace" />
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Icon name="spark" />
            <p>A little context.<br /><strong>A more connected team.</strong></p>
            <Link href="/me">Share an update <Icon name="arrow" width={16} height={16} /></Link>
          </div>
          <span className="sidebar-caption">Make room for focused work.</span>
        </div>
      </aside>
      <header className="app-topbar">
        <Link href="/board" className="mobile-brand" aria-label="Workspace board"><Wordmark size={28} /></Link>
        <div className="topbar-context"><Icon name="team" width={17} height={17} /><span>Your team space</span><span className="topbar-divider" /><span className="topbar-caption">Stay in the loop, at a glance.</span></div>
        <div className="topbar-account">
          <NotificationBell profileId={profileId} />
          <span className="topbar-divider" aria-hidden="true" />
          <AccountMenu displayName={displayName} isHead={isHead} />
        </div>
      </header>
      <div className="mobile-navigation"><NavLinks items={[...NAV, ...SETTINGS]} label="Mobile workspace" /></div>
    </>
  );
}
