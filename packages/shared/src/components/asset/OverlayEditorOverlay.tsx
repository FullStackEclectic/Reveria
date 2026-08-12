import React, { useRef } from "react";
import type { OverlayLayer, RetouchSettings } from "./editorConstants";
import { MAX_OVERLAY_MASK_POINTS } from "./retouch/overlays";

interface Props {
  settings: RetouchSettings;
  layer: OverlayLayer;
  mode: "move" | "mask";
  maskTool: "paint" | "erase";
  brushSize: number;
  onChange: (layer: OverlayLayer) => void;
  onCommit: (layer: OverlayLayer) => void;
}

export function OverlayEditorOverlay({
  settings, layer, mode, maskTool, brushSize, onChange, onCommit,
}: Props) {
  const drawingRef = useRef(false);
  const layerRef = useRef(layer);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  layerRef.current = layer;

  const locate = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
      rect,
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastPointRef.current = null;
    onPointerMove(event);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current) return;
    const { x, y, rect } = locate(event);
    if (mode === "move" && layer.kind === "text") {
      const next = { ...layerRef.current, x, y };
      layerRef.current = next;
      onChange(next);
      return;
    }
    if (mode !== "mask") return;
    const radius = (brushSize / 2 / Math.min(rect.width, rect.height))
      * Math.min(settings.crop_width, settings.crop_height);
    const previous = lastPointRef.current;
    if (previous && Math.hypot(x - previous.x, y - previous.y) < radius * 0.28) return;
    lastPointRef.current = { x, y };
    const next: OverlayLayer = {
      ...layerRef.current,
      mask_points: [...layerRef.current.mask_points, {
        x, y, radius, opacity: 0.85, erase: maskTool === "erase",
      }].slice(-MAX_OVERLAY_MASK_POINTS),
    };
    layerRef.current = next;
    onChange(next);
  };

  const onPointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onCommit(layerRef.current);
  };

  return (
    <div
      className="overlay-editor-hit"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}
