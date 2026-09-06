import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

export function PageHeader({ title, eyebrow, description, meta, action }: {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-heading">
        {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
        <div className="page-title-row"><h1>{title}</h1>{meta && <span className="page-meta">{meta}</span>}</div>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </header>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state rise-in">
      <span className="empty-state-icon"><Icon name="board" width={25} height={25} /></span>
      <h2>{title}</h2>
      {hint && <p>{hint}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`panel ${className}`}>{children}</div>;
}
