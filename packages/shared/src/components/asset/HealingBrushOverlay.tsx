import React, { useRef, useState } from "react";
import { HealingSpot, MAX_HEALING_SPOTS, RetouchSettings } from "./editorConstants";

interface Props {
  settings: RetouchSettings;
  brushSize: number;
  strength: number;
  onChange: (spots: HealingSpot[]) => void;
  onCommit: (spots: HealingSpot[]) => void;
}

export function displayToSource(x: number, y: number, settings: RetouchSettings) {
  let dx = settings.crop_x + x * settings.crop_width;
  let dy = settings.crop_y + y * settings.crop_height;
  if (settings.flip_horizontal) dx = 1 - dx;
  if (settings.flip_vertical) dy = 1 - dy;
  switch (Math.round(settings.rotation) % 4) {
    case 1: return { x: dy, y: 1 - dx };
    case 2: return { x: 1 - dx, y: 1 - dy };
    case 3: return { x: 1 - dy, y: dx };
    default: return { x: dx, y: dy };
  }
}

export function HealingBrushOverlay({ settings, brushSize, strength, onChange, onCommit }: Props) {
  const drawingRef = useRef(false);
  const spotsRef = useRef(settings.healing_spots);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  spotsRef.current = settings.healing_spots;

  const addSpot = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const localY = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    setCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    const point = displayToSource(localX, localY, settings);
    const radius = (brushSize / 2 / Math.min(rect.width, rect.height))
      * Math.min(settings.crop_width, settings.crop_height);
    const previous = lastPointRef.current;
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < radius * 0.55) return;
    const next = [...spotsRef.current, { ...point, radius, strength: strength / 100 }].slice(-MAX_HEALING_SPOTS);
    spotsRef.current = next;
    lastPointRef.current = point;
    onChange(next);
  };

  const finish = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onCommit(spotsRef.current);
  };

  return (
    <div
      className="healing-brush-overlay"
      onPointerDown={(event) => {
        event.preventDefault();
        drawingRef.current = true;
        spotsRef.current = settings.healing_spots;
        event.currentTarget.setPointerCapture(event.pointerId);
        addSpot(event);
      }}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top });
        if (drawingRef.current) addSpot(event);
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onPointerLeave={() => { if (!drawingRef.current) setCursor(null); }}
    >
      {cursor && (
        <span className="healing-brush-cursor" style={{ left: cursor.x, top: cursor.y, width: brushSize, height: brushSize }} />
      )}
    </div>
  );
}
