import React, { useRef, useState } from "react";
import { MAX_LIQUIFY_STROKES, type LiquifyStroke, type RetouchSettings } from "./editorConstants";
import { displayToSource } from "./HealingBrushOverlay";

/** 还原不是一种位移，而是擦除已有笔画，因此单独于 LiquifyMode 之外 */
export type LiquifyTool = "push" | "pucker" | "bloat" | "restore";

const TOOL_MODE: Record<Exclude<LiquifyTool, "restore">, 0 | 1 | 2> = {
  push: 0,
  pucker: 1,
  bloat: 2,
};

interface Props {
  settings: RetouchSettings;
  tool: LiquifyTool;
  brushSize: number;
  strength: number;
  onChange: (strokes: LiquifyStroke[]) => void;
  onCommit: (strokes: LiquifyStroke[]) => void;
}

/**
 * 高精液化：拖拽产生位移笔画，笔画被烘焙成位移贴图后由 Shader 采样。
 * 推拉沿拖动方向搬运像素，收缩 / 膨胀以笔刷中心做径向缩放，还原则擦除范围内的既有笔画。
 */
export function LiquifyOverlay({ settings, tool, brushSize, strength, onChange, onCommit }: Props) {
  const drawingRef = useRef(false);
  const strokesRef = useRef<LiquifyStroke[]>(settings.liquify_strokes);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  strokesRef.current = settings.liquify_strokes;

  const toLocal = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      rect,
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const apply = (event: React.PointerEvent<HTMLDivElement>) => {
    const { rect, x, y } = toLocal(event);
    setCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    const point = displayToSource(x, y, settings);
    const radius = (brushSize / 2 / Math.min(rect.width, rect.height))
      * Math.min(settings.crop_width, settings.crop_height);
    const previous = lastPointRef.current;

    if (tool === "restore") {
      // 擦除落在笔刷范围内的笔画
      const kept = strokesRef.current.filter(
        (stroke) => Math.hypot(stroke.x - point.x, stroke.y - point.y) > radius,
      );
      if (kept.length !== strokesRef.current.length) {
        strokesRef.current = kept;
        onChange(kept);
      }
      lastPointRef.current = point;
      return;
    }

    if (tool === "push") {
      // 推拉需要方向，第一个点只作为起点记录
      if (!previous) {
        lastPointRef.current = point;
        return;
      }
      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      if (Math.hypot(dx, dy) < radius * 0.06) return;
      const next = [
        ...strokesRef.current,
        { x: point.x, y: point.y, dx, dy, radius, strength: strength / 100, mode: TOOL_MODE.push },
      ].slice(-MAX_LIQUIFY_STROKES) as LiquifyStroke[];
      strokesRef.current = next;
      lastPointRef.current = point;
      onChange(next);
      return;
    }

    // 收缩 / 膨胀：沿拖动路径按间隔落点，停在原地也能持续加强
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < radius * 0.25) return;
    const next = [
      ...strokesRef.current,
      {
        x: point.x, y: point.y, dx: 0, dy: 0, radius,
        strength: strength / 100, mode: TOOL_MODE[tool],
      },
    ].slice(-MAX_LIQUIFY_STROKES) as LiquifyStroke[];
    strokesRef.current = next;
    lastPointRef.current = point;
    onChange(next);
  };

  const finish = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onCommit(strokesRef.current);
  };

  return (
    <div
      className="liquify-overlay"
      onPointerDown={(event) => {
        event.preventDefault();
        drawingRef.current = true;
        strokesRef.current = settings.liquify_strokes;
        lastPointRef.current = null;
        event.currentTarget.setPointerCapture(event.pointerId);
        apply(event);
      }}
      onPointerMove={(event) => {
        const { rect } = toLocal(event);
        setCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top });
        if (drawingRef.current) apply(event);
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onPointerLeave={() => { if (!drawingRef.current) setCursor(null); }}
    >
      {cursor && (
        <span
          className={`liquify-brush-cursor ${tool}`}
          style={{ left: cursor.x, top: cursor.y, width: brushSize, height: brushSize }}
        />
      )}
    </div>
  );
}
