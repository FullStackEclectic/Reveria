import React, { ReactNode } from "react";

interface PageFrameProps {
  action?: ReactNode;
  children: ReactNode;
  eyebrow?: string;
  status: string;
  title: string;
}

export function PageFrame({
  action,
  children,
  eyebrow,
  status,
  title,
}: PageFrameProps) {
  return (
    <section className="workspace">
      <header className="topbar">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
          <p className="workspace-status">{status}</p>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
