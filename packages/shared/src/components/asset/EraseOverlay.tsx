import React, { useRef, useState } from "react";
import type { RetouchSettings } from "./editorConstants";

export interface EraseMaskCircle {
  /** 显示 UV 坐标 (0-1)，以叠加层左上角为原点 */
  x: number;
  y: number;
  radius: number;
}

export type EraseMode = "mark" | "restore";

const MAX_ERASE_CIRCLES = 300;

/**
 * 将蒙版圆列表渲染成 PNG Data URL（白色=消除，黑色=保留）。
 * width/height 建议与原图一致；若为 0 则返回 null。
 */
export function generateMaskDataUrl(
  masks: EraseMaskCircle[],
  width: number,
  height: number,
): string | null {
  if (width <= 0 || height <= 0 || masks.length === 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  for (const circle of masks) {
    ctx.beginPath();
    ctx.arc(
      circle.x * width,
      circle.y * height,
      circle.radius * Math.min(width, height),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  return canvas.toDataURL("image/png");
}

interface Props {
  settings: RetouchSettings;
  mode: EraseMode;
  brushSize: number;
  masks: EraseMaskCircle[];
  onChange: (masks: EraseMaskCircle[]) => void;
  onCommit: (masks: EraseMaskCircle[]) => void;
}

/**
 * 智能消除蒙版采集叠加层。
 * 蒙版存储为显示 UV 坐标（与叠加层像素 1:1 对应），半透明红色圆标记待消除区域。
 * 本层不影响 RetouchSettings，消除结果由后端 AI Inpainting 返回后替换素材。
 */
export function EraseOverlay({ mode, brushSize, masks, onChange, onCommit }: Props) {
  const drawingRef = useRef(false);
  const masksRef = useRef<EraseMaskCircle[]>(masks);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 1, h: 1 });
  masksRef.current = masks;

  const toUV = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      rect,
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
      px: event.clientX - rect.left,
      py: event.clientY - rect.top,
    };
  };

  const apply = (event: React.PointerEvent<HTMLDivElement>) => {
    const { rect, x, y, px, py } = toUV(event);
    setCursor({ x: px, y: py });
    const radius = brushSize / 2 / Math.min(rect.width, rect.height);
    const previous = lastPointRef.current;

    if (mode === "restore") {
      const kept = masksRef.current.filter(
        (circle) => Math.hypot(circle.x - x, circle.y - y) > radius,
      );
      if (kept.length !== masksRef.current.length) {
        masksRef.current = kept;
        onChange(kept);
      }
      lastPointRef.current = { x, y };
      return;
    }

    if (previous && Math.hypot(x - previous.x, y - previous.y) < radius * 0.5) return;
    const next = [...masksRef.current, { x, y, radius }].slice(-MAX_ERASE_CIRCLES);
    masksRef.current = next;
    lastPointRef.current = { x, y };
    onChange(next);
  };

  const finish = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onCommit(masksRef.current);
  };

  return (
    <div
      className="erase-overlay"
      onPointerDown={(event) => {
        event.preventDefault();
        drawingRef.current = true;
        masksRef.current = masks;
        lastPointRef.current = null;
        event.currentTarget.setPointerCapture(event.pointerId);
        const rect = event.currentTarget.getBoundingClientRect();
        setContainerSize({ w: rect.width, h: rect.height });
        apply(event);
      }}
      onPointerMove={(event) => {
        const { rect, px, py } = toUV(event);
        setCursor({ x: px, y: py });
        setContainerSize({ w: rect.width, h: rect.height });
        if (drawingRef.current) apply(event);
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onPointerLeave={() => { if (!drawingRef.current) setCursor(null); }}
    >
      <svg
        className="erase-mask-svg"
        width={containerSize.w}
        height={containerSize.h}
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      >
        {masks.map((circle, index) => (
          <circle
            key={index}
            cx={circle.x * containerSize.w}
            cy={circle.y * containerSize.h}
            r={circle.radius * Math.min(containerSize.w, containerSize.h)}
            fill="rgba(255,50,50,0.30)"
            stroke="rgba(255,80,80,0.65)"
            strokeWidth={1}
          />
        ))}
      </svg>
      {cursor && (
        <span
          className={`erase-brush-cursor ${mode}`}
          style={{ left: cursor.x, top: cursor.y, width: brushSize, height: brushSize }}
        />
      )}
    </div>
  );
}
