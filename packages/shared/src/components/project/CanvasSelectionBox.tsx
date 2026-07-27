import React from "react";

interface CanvasSelectionBoxProps {
  /** 以视口左上角为原点的框选矩形，与 CanvasViewport 的命中判定同一坐标系。 */
  selection: { startX: number; startY: number; curX: number; curY: number };
}

export function CanvasSelectionBox({ selection }: CanvasSelectionBoxProps) {
  return (
    <div
      style={{
        position: "absolute",
        left: Math.min(selection.startX, selection.curX),
        top: Math.min(selection.startY, selection.curY),
        width: Math.abs(selection.startX - selection.curX),
        height: Math.abs(selection.startY - selection.curY),
        border: "1.5px dashed var(--rv-color-primary)",
        background: "rgba(15, 118, 110, 0.08)",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}
