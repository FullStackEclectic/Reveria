import { useRef } from "react";
import { Check, RotateCcw, X } from "lucide-react";

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  value: CropRect;
  onChange: (value: CropRect) => void;
  onApply: () => void;
  onCancel: () => void;
}

type DragMode = "move" | "nw" | "ne" | "sw" | "se";

const MIN_SIZE = 0.05;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function CropOverlay({ value, onChange, onApply, onCancel }: Props) {
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    initial: CropRect;
  } | null>(null);

  const beginDrag = (event: React.PointerEvent, mode: DragMode) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, initial: value };
  };

  const moveDrag = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const bounds = event.currentTarget.closest(".crop-overlay")?.getBoundingClientRect();
    if (!bounds) return;
    const dx = (event.clientX - drag.startX) / bounds.width;
    const dy = (event.clientY - drag.startY) / bounds.height;
    const initial = drag.initial;

    if (drag.mode === "move") {
      onChange({
        ...initial,
        x: clamp(initial.x + dx, 0, 1 - initial.width),
        y: clamp(initial.y + dy, 0, 1 - initial.height),
      });
      return;
    }

    let left = initial.x;
    let top = initial.y;
    let right = initial.x + initial.width;
    let bottom = initial.y + initial.height;
    if (drag.mode.includes("w")) left = clamp(initial.x + dx, 0, right - MIN_SIZE);
    if (drag.mode.includes("e")) right = clamp(right + dx, left + MIN_SIZE, 1);
    if (drag.mode.includes("n")) top = clamp(initial.y + dy, 0, bottom - MIN_SIZE);
    if (drag.mode.includes("s")) bottom = clamp(bottom + dy, top + MIN_SIZE, 1);
    onChange({ x: left, y: top, width: right - left, height: bottom - top });
  };

  const endDrag = (event: React.PointerEvent) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  return (
    <div className="crop-overlay">
      <div
        className="crop-selection"
        style={{
          left: `${value.x * 100}%`,
          top: `${value.y * 100}%`,
          width: `${value.width * 100}%`,
          height: `${value.height * 100}%`,
        }}
        onPointerDown={(event) => beginDrag(event, "move")}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="crop-grid vertical first" />
        <span className="crop-grid vertical second" />
        <span className="crop-grid horizontal first" />
        <span className="crop-grid horizontal second" />
        {(["nw", "ne", "sw", "se"] as DragMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            className={`crop-handle ${mode}`}
            aria-label={`裁剪控制点 ${mode}`}
            onPointerDown={(event) => beginDrag(event, mode)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        ))}
      </div>
      <div className="crop-actions">
        <button type="button" title="重置裁剪" onClick={() => onChange({ x: 0, y: 0, width: 1, height: 1 })}>
          <RotateCcw size={14} />
        </button>
        <button type="button" title="取消裁剪" onClick={onCancel}><X size={14} /></button>
        <button type="button" className="primary" title="应用裁剪" onClick={onApply}><Check size={14} /></button>
      </div>
    </div>
  );
}
