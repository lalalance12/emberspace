"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icon";

export interface NavItem {
  href: string;
  label: string;
  icon?: IconName;
}

export function NavLinks({ items, label = "Emberspace" }: { items: NavItem[]; label?: string }) {
  const pathname = usePathname();
  return (
    <nav className="app-nav" aria-label={label}>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className="app-nav-link">
            {item.icon && <Icon name={item.icon} />}
            <span>{item.label}</span>
            {active && <span className="nav-active-dot" aria-hidden="true" />}
            <PendingUnderline />
          </Link>
        );
      })}
    </nav>
  );
}

function PendingUnderline() {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden="true" className="nav-pending" /> : null;
}
