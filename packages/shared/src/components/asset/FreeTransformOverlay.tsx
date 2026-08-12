import { useRef } from "react";
import { Check, RotateCcw } from "lucide-react";
import {
  IDENTITY_FREE_TRANSFORM,
  type FreeTransformPoints,
} from "./retouch/freeTransform";

interface Props {
  points: [number, number][];
  onChange: (points: FreeTransformPoints) => void;
  onCommit: (points: FreeTransformPoints) => void;
  onClose: () => void;
}

const HANDLE_META = [
  { index: 0, label: "左上", cursor: "nwse-resize" },
  { index: 1, label: "右上", cursor: "nesw-resize" },
  { index: 2, label: "右下", cursor: "nwse-resize" },
  { index: 3, label: "左下", cursor: "nesw-resize" },
  { index: 4, label: "上边", cursor: "ns-resize" },
  { index: 5, label: "右边", cursor: "ew-resize" },
  { index: 6, label: "下边", cursor: "ns-resize" },
  { index: 7, label: "左边", cursor: "ew-resize" },
] as const;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function asPoints(value: [number, number][]): FreeTransformPoints {
  return (value.length === 8 ? value : IDENTITY_FREE_TRANSFORM) as FreeTransformPoints;
}

export function FreeTransformOverlay({ points, onChange, onCommit, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ index: number } | null>(null);
  const latestRef = useRef<FreeTransformPoints>(asPoints(points));
  latestRef.current = asPoints(points);

  const toUv = (clientX: number, clientY: number): [number, number] => {
    const bounds = overlayRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return [0, 0];
    return [
      clamp((clientX - bounds.left) / bounds.width, -0.5, 1.5),
      clamp((clientY - bounds.top) / bounds.height, -0.5, 1.5),
    ];
  };

  const beginDrag = (event: React.PointerEvent, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { index };
  };

  const moveDrag = (event: React.PointerEvent) => {
    if (!dragRef.current) return;
    const next = latestRef.current.map((point, index) => (
      index === dragRef.current?.index ? toUv(event.clientX, event.clientY) : point
    )) as FreeTransformPoints;
    latestRef.current = next;
    onChange(next);
  };

  const endDrag = (event: React.PointerEvent) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!dragRef.current) return;
    dragRef.current = null;
    onCommit(latestRef.current);
  };

  const [tl, tr, br, bl, mt, mr, mb, ml] = latestRef.current;
  const outline = [tl, mt, tr, mr, br, mb, bl, ml].map(([x, y]) => `${x},${y}`).join(" ");

  return (
    <div ref={overlayRef} className="free-transform-overlay">
      <svg className="free-transform-mesh" viewBox="0 0 1 1" preserveAspectRatio="none">
        <polygon className="free-transform-fill" points={outline} />
        <polygon className="free-transform-outline" points={outline} />
        <line x1={mt[0]} y1={mt[1]} x2={mb[0]} y2={mb[1]} />
        <line x1={ml[0]} y1={ml[1]} x2={mr[0]} y2={mr[1]} />
      </svg>
      {HANDLE_META.map(({ index, label, cursor }) => (
        <button
          key={index}
          type="button"
          className="free-transform-handle"
          style={{
            left: `${latestRef.current[index][0] * 100}%`,
            top: `${latestRef.current[index][1] * 100}%`,
            cursor,
          }}
          aria-label={`自由变形控制点 ${label}`}
          onPointerDown={(event) => beginDrag(event, index)}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
      ))}
      <div className="crop-actions">
        <button
          type="button"
          title="重置变形"
          onClick={() => {
            const identity = IDENTITY_FREE_TRANSFORM.map((point) => [...point]) as FreeTransformPoints;
            latestRef.current = identity;
            onCommit(identity);
          }}
        >
          <RotateCcw size={14} />
        </button>
        <button type="button" className="primary" title="完成变形" onClick={onClose}>
          <Check size={14} />
        </button>
      </div>
    </div>
  );
}
