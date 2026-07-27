import React, { useRef, useState } from "react";
import type { LocalMask, RetouchSettings } from "./editorConstants";
import { MAX_LOCAL_MASK_POINTS } from "./editorConstants";
import { displayToSource } from "./HealingBrushOverlay";
import { rgbToHsl } from "./retouch/localMasks";

export type LocalMaskBrushTool = "paint" | "erase";

interface Props {
  settings: RetouchSettings;
  mask: LocalMask;
  brushTool: LocalMaskBrushTool;
  brushSize: number;
  brushFlow: number;
  sampleColor: (x: number, y: number) => [number, number, number] | null;
  onChange: (mask: LocalMask) => void;
  onCommit: (mask: LocalMask) => void;
}

interface PointerPosition {
  rect: DOMRect;
  localX: number;
  localY: number;
  pixelX: number;
  pixelY: number;
}

export function LocalMaskOverlay({
  settings, mask, brushTool, brushSize, brushFlow, sampleColor, onChange, onCommit,
}: Props) {
  const drawingRef = useRef(false);
  const maskRef = useRef(mask);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [dragLine, setDragLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  maskRef.current = mask;

  const locate = (event: React.PointerEvent<HTMLDivElement>): PointerPosition => {
    const rect = event.currentTarget.getBoundingClientRect();
    const pixelX = event.clientX - rect.left;
    const pixelY = event.clientY - rect.top;
    return {
      rect,
      localX: Math.min(1, Math.max(0, pixelX / rect.width)),
      localY: Math.min(1, Math.max(0, pixelY / rect.height)),
      pixelX,
      pixelY,
    };
  };

  const sampledPatch = (localX: number, localY: number) => {
    const source = displayToSource(localX, localY, settings);
    const sampled = sampleColor(source.x, source.y);
    if (!sampled) return {};
    const [hue, saturation, luminance] = rgbToHsl(sampled[0], sampled[1], sampled[2]);
    return { sample_hue: hue, sample_saturation: saturation, sample_luminance: luminance };
  };

  const updateMask = (next: LocalMask) => {
    maskRef.current = next;
    onChange(next);
  };

  const applyBrush = (position: PointerPosition) => {
    const point = displayToSource(position.localX, position.localY, settings);
    const radius = (brushSize / 2 / Math.min(position.rect.width, position.rect.height))
      * Math.min(settings.crop_width, settings.crop_height);
    const previous = lastPointRef.current;
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < radius * 0.28) return;
    const sample = maskRef.current.points.length === 0 && maskRef.current.edge_aware
      ? sampledPatch(position.localX, position.localY)
      : {};
    const next: LocalMask = {
      ...maskRef.current,
      ...sample,
      points: [...maskRef.current.points, {
        ...point,
        radius,
        opacity: brushFlow / 100,
        erase: brushTool === "erase",
      }].slice(-MAX_LOCAL_MASK_POINTS),
    };
    lastPointRef.current = point;
    updateMask(next);
  };

  const applyGeometry = (position: PointerPosition) => {
    const point = displayToSource(position.localX, position.localY, settings);
    const start = dragStartRef.current ?? point;
    if (mask.type === "linear") {
      updateMask({ ...maskRef.current, start_x: start.x, start_y: start.y, end_x: point.x, end_y: point.y });
    } else if (mask.type === "radial") {
      updateMask({
        ...maskRef.current,
        center_x: start.x,
        center_y: start.y,
        radius_x: Math.max(0.01, Math.abs(point.x - start.x)),
        radius_y: Math.max(0.01, Math.abs(point.y - start.y)),
      });
    }
    setDragLine((current) => current ? { ...current, x2: position.pixelX, y2: position.pixelY } : null);
  };

  const applySampleMask = (position: PointerPosition) => {
    const sample = sampledPatch(position.localX, position.localY);
    if (Object.keys(sample).length === 0) return;
    const next = mask.type === "color"
      ? { ...maskRef.current, ...sample, color_hue: (sample.sample_hue ?? 0) * 360 }
      : {
          ...maskRef.current,
          ...sample,
          luminance_min: Math.max(0, (sample.sample_luminance ?? 0.5) - 0.16),
          luminance_max: Math.min(1, (sample.sample_luminance ?? 0.5) + 0.16),
        };
    updateMask(next);
  };

  const finish = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    dragStartRef.current = null;
    setDragLine(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
    onCommit(maskRef.current);
  };

  return (
    <div
      className={`local-mask-overlay local-mask-${mask.type}`}
      onPointerDown={(event) => {
        event.preventDefault();
        const position = locate(event);
        drawingRef.current = true;
        maskRef.current = mask;
        event.currentTarget.setPointerCapture(event.pointerId);
        setCursor({ x: position.pixelX, y: position.pixelY });
        if (mask.type === "brush") {
          applyBrush(position);
        } else if (mask.type === "linear" || mask.type === "radial") {
          const start = displayToSource(position.localX, position.localY, settings);
          dragStartRef.current = start;
          setDragLine({ x1: position.pixelX, y1: position.pixelY, x2: position.pixelX, y2: position.pixelY });
          applyGeometry(position);
        } else {
          applySampleMask(position);
        }
      }}
      onPointerMove={(event) => {
        const position = locate(event);
        setCursor({ x: position.pixelX, y: position.pixelY });
        if (!drawingRef.current) return;
        if (mask.type === "brush") applyBrush(position);
        else if (mask.type === "linear" || mask.type === "radial") applyGeometry(position);
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onPointerLeave={() => { if (!drawingRef.current) setCursor(null); }}
    >
      {cursor && mask.type === "brush" && (
        <span
          className={`local-mask-brush-cursor ${brushTool}`}
          style={{ left: cursor.x, top: cursor.y, width: brushSize, height: brushSize }}
        />
      )}
      {dragLine && (
        <svg className="local-mask-drag-guide" aria-hidden="true">
          <line x1={dragLine.x1} y1={dragLine.y1} x2={dragLine.x2} y2={dragLine.y2} />
          <circle cx={dragLine.x1} cy={dragLine.y1} r="4" />
          <circle cx={dragLine.x2} cy={dragLine.y2} r="4" />
        </svg>
      )}
    </div>
  );
}
