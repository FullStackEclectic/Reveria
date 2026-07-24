import React, { useRef, useState } from "react";
import { CloneStamp, MAX_CLONE_STAMPS, RetouchSettings } from "./editorConstants";
import { displayToSource } from "./HealingBrushOverlay";

interface Props {
  settings: RetouchSettings;
  brushSize: number;
  strength: number;
  source: { x: number; y: number } | null;
  samplingSource: boolean;
  onSourceChange: (source: { x: number; y: number }) => void;
  onChange: (stamps: CloneStamp[]) => void;
  onCommit: (stamps: CloneStamp[]) => void;
}

export function CloneStampOverlay({ settings, brushSize, strength, source, samplingSource, onSourceChange, onChange, onCommit }: Props) {
  const drawingRef = useRef(false);
  const stampsRef = useRef(settings.clone_stamps);
  const strokeTargetRef = useRef<{ x: number; y: number } | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  stampsRef.current = settings.clone_stamps;

  const eventPoint = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const localY = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    return { rect, point: displayToSource(localX, localY, settings) };
  };

  const addStamp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!source || !strokeTargetRef.current) return;
    const { rect, point } = eventPoint(event);
    const radius = (brushSize / 2 / Math.min(rect.width, rect.height)) * Math.min(settings.crop_width, settings.crop_height);
    const previous = lastPointRef.current;
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < radius * 0.55) return;
    const sourceX = Math.min(1, Math.max(0, source.x + point.x - strokeTargetRef.current.x));
    const sourceY = Math.min(1, Math.max(0, source.y + point.y - strokeTargetRef.current.y));
    const next = [...stampsRef.current, { ...point, sourceX, sourceY, radius, strength: strength / 100 }].slice(-MAX_CLONE_STAMPS);
    stampsRef.current = next;
    lastPointRef.current = point;
    onChange(next);
  };

  const finish = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    strokeTargetRef.current = null;
    lastPointRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onCommit(stampsRef.current);
  };

  return (
    <div
      className={`healing-brush-overlay ${samplingSource ? "sampling-source" : ""}`}
      onPointerDown={(event) => {
        event.preventDefault();
        const { point } = eventPoint(event);
        if (samplingSource || !source) { onSourceChange(point); return; }
        drawingRef.current = true;
        stampsRef.current = settings.clone_stamps;
        strokeTargetRef.current = point;
        event.currentTarget.setPointerCapture(event.pointerId);
        addStamp(event);
      }}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top });
        if (drawingRef.current) addStamp(event);
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onPointerLeave={() => { if (!drawingRef.current) setCursor(null); }}
    >
      {cursor && <span className="healing-brush-cursor" style={{ left: cursor.x, top: cursor.y, width: brushSize, height: brushSize }} />}
    </div>
  );
}
