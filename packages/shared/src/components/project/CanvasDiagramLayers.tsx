import React from "react";
import { CanvasConnection, CanvasItem } from "../../types";

interface CanvasDiagramLayersProps {
  items: CanvasItem[];
  connections: CanvasConnection[];
  guides: { type: "v" | "h"; value: number }[];
  zoom: number;
}

function getConnectionPoints(from: CanvasItem, to: CanvasItem) {
  const fromCx = from.x + from.w / 2;
  const fromCy = from.y + from.h / 2;
  const toCx = to.x + to.w / 2;
  const toCy = to.y + to.h / 2;
  const dx = toCx - fromCx;
  const dy = toCy - fromCy;
  let x1 = fromCx;
  let y1 = fromCy;
  let x2 = toCx;
  let y2 = toCy;

  if (Math.abs(dx) > Math.abs(dy)) {
    x1 = dx > 0 ? from.x + from.w : from.x;
    x2 = dx > 0 ? to.x : to.x + to.w;
  } else {
    y1 = dy > 0 ? from.y + from.h : from.y;
    y2 = dy > 0 ? to.y : to.y + to.h;
  }
  return { x1, y1, x2, y2, dx };
}

export function CanvasDiagramLayers({ items, connections, guides, zoom }: CanvasDiagramLayersProps) {
  return (
    <>
      {connections.length > 0 ? (
        <svg className="canvas-connections-svg" style={{ position: "absolute", top: 0, left: 0, width: "10000px", height: "10000px", pointerEvents: "none", zIndex: 1 }}>
          <defs>
            <marker id="arrow-marker" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="rgba(15, 118, 110, 0.45)" />
            </marker>
          </defs>
          {connections.map((connection) => {
            const from = items.find((item) => item.id === connection.fromItemId);
            const to = items.find((item) => item.id === connection.toItemId);
            if (!from || !to) return null;
            const { x1, y1, x2, y2, dx } = getConnectionPoints(from, to);
            const distance = Math.min(100, Math.abs(dx) * 0.4);
            const direction = dx > 0 ? distance : -distance;
            const path = `M ${x1} ${y1} C ${x1 + direction} ${y1}, ${x2 - direction} ${y2}, ${x2} ${y2}`;
            return <path key={connection.id} d={path} stroke="rgba(15, 118, 110, 0.45)" strokeWidth="2.5" fill="none" markerEnd="url(#arrow-marker)" strokeDasharray="4 4" />;
          })}
        </svg>
      ) : null}

      {guides.length > 0 ? (
        <svg className="canvas-guides-svg" style={{ position: "absolute", top: 0, left: 0, width: "10000px", height: "10000px", pointerEvents: "none", zIndex: 20 }}>
          {guides.map((guide, index) => guide.type === "v" ? (
            <line key={`${guide.type}-${guide.value}-${index}`} x1={guide.value} y1={-99999} x2={guide.value} y2={99999} stroke="#ef4444" strokeWidth={1 / zoom} strokeDasharray="4 4" />
          ) : (
            <line key={`${guide.type}-${guide.value}-${index}`} x1={-99999} y1={guide.value} x2={99999} y2={guide.value} stroke="#ef4444" strokeWidth={1 / zoom} strokeDasharray="4 4" />
          ))}
        </svg>
      ) : null}
    </>
  );
}
