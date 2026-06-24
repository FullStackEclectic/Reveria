import React from "react";
import { CheckCircle2 } from "lucide-react";

export function EntityList({
  emptyText,
  items,
}: {
  emptyText: string;
  items: Array<{
    id: string;
    title: string;
    subtitle: string;
    enabled: boolean;
  }>;
}) {
  if (!items.length) {
    return (
      <div className="empty-state compact-empty">
        <p>{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="entity-list">
      {items.map((item) => (
        <div className="entity-row" key={item.id}>
          <div>
            <strong>{item.title}</strong>
            <span>{item.subtitle}</span>
          </div>
          <small className={item.enabled ? "status-on" : "status-off"}>
            <CheckCircle2 size={14} aria-hidden="true" />
            {item.enabled ? "启用" : "停用"}
          </small>
        </div>
      ))}
    </div>
  );
}
