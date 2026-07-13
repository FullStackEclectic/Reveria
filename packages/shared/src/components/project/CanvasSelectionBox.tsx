import React from "react";

interface CanvasSelectionBoxProps {
  selection: { startX: number; startY: number; curX: number; curY: number };
  viewportRect?: DOMRect;
}

export function CanvasSelectionBox({ selection, viewportRect }: CanvasSelectionBoxProps) {
  const left = viewportRect ? Math.min(selection.startX, selection.curX) - viewportRect.left : 0;
  const top = viewportRect ? Math.min(selection.startY, selection.curY) - viewportRect.top : 0;
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
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
