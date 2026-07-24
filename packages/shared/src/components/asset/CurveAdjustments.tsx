import React, { useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { CurveKey, CurvePoints, IDENTITY_CURVE, RetouchSettings } from "./editorConstants";

interface Props {
  settings: RetouchSettings;
  onChange: (key: CurveKey, value: CurvePoints) => void;
  onCommit: (key: CurveKey, value: CurvePoints) => void;
}

const SIZE = 220;
const PADDING = 12;
const INNER = SIZE - PADDING * 2;

const CHANNELS: Array<{ key: CurveKey; label: string; color: string }> = [
  { key: "curve_rgb", label: "RGB", color: "#e4e4e7" },
  { key: "curve_red", label: "红", color: "#f87171" },
  { key: "curve_green", label: "绿", color: "#4ade80" },
  { key: "curve_blue", label: "蓝", color: "#60a5fa" },
];

function toPath(points: CurvePoints) {
  return points
    .map((point, index) => {
      const x = PADDING + (index / 4) * INNER;
      const y = PADDING + (1 - point) * INNER;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

export function CurveAdjustments({ settings, onChange, onCommit }: Props) {
  const [activeKey, setActiveKey] = useState<CurveKey>("curve_rgb");
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ index: number; points: CurvePoints } | null>(null);
  const activeChannel = CHANNELS.find((channel) => channel.key === activeKey)!;
  const points = settings[activeKey];

  const updatePoint = (clientY: number) => {
    const drag = dragRef.current;
    const svg = svgRef.current;
    if (!drag || !svg) return;
    const rect = svg.getBoundingClientRect();
    const svgY = ((clientY - rect.top) / rect.height) * SIZE;
    const value = Math.min(1, Math.max(0, 1 - (svgY - PADDING) / INNER));
    const next = [...drag.points] as CurvePoints;
    next[drag.index] = Math.round(value * 1000) / 1000;
    drag.points = next;
    onChange(activeKey, next);
  };

  const finishDrag = (pointerId: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    svgRef.current?.releasePointerCapture(pointerId);
    dragRef.current = null;
    onCommit(activeKey, drag.points);
  };

  const resetCurrent = () => {
    const identity = [...IDENTITY_CURVE] as CurvePoints;
    onChange(activeKey, identity);
    onCommit(activeKey, identity);
  };

  return (
    <div className="curve-adjustments">
      <div className="curve-toolbar">
        <div className="curve-channel-selector" role="group" aria-label="曲线通道">
          {CHANNELS.map((channel) => (
            <button
              type="button"
              key={channel.key}
              className={`curve-channel-btn ${activeKey === channel.key ? "active" : ""}`}
              style={{ color: activeKey === channel.key ? channel.color : undefined }}
              onClick={() => setActiveKey(channel.key)}
            >
              {channel.label}
            </button>
          ))}
        </div>
        <button type="button" className="curve-reset-btn" title="重置当前曲线" aria-label="重置当前曲线" onClick={resetCurrent}>
          <RotateCcw size={14} />
        </button>
      </div>

      <svg
        ref={svgRef}
        className="curve-editor"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`${activeChannel.label} 曲线编辑器`}
        onDoubleClick={resetCurrent}
        onPointerMove={(event) => updatePoint(event.clientY)}
        onPointerUp={(event) => finishDrag(event.pointerId)}
        onPointerCancel={(event) => finishDrag(event.pointerId)}
      >
        <rect className="curve-editor-bg" x="0" y="0" width={SIZE} height={SIZE} />
        {[0, 1, 2, 3, 4].map((line) => {
          const position = PADDING + (line / 4) * INNER;
          return (
            <React.Fragment key={line}>
              <line className="curve-grid-line" x1={PADDING} y1={position} x2={SIZE - PADDING} y2={position} />
              <line className="curve-grid-line" x1={position} y1={PADDING} x2={position} y2={SIZE - PADDING} />
            </React.Fragment>
          );
        })}
        <path className="curve-identity-line" d={`M ${PADDING} ${SIZE - PADDING} L ${SIZE - PADDING} ${PADDING}`} />
        <path className="curve-line" style={{ stroke: activeChannel.color }} d={toPath(points)} />
        {points.map((point, index) => (
          <circle
            key={index}
            className="curve-control-point"
            style={{ stroke: activeChannel.color }}
            cx={PADDING + (index / 4) * INNER}
            cy={PADDING + (1 - point) * INNER}
            r="5"
            onPointerDown={(event) => {
              event.preventDefault();
              svgRef.current?.setPointerCapture(event.pointerId);
              dragRef.current = { index, points: [...points] as CurvePoints };
              updatePoint(event.clientY);
            }}
          />
        ))}
      </svg>
      <div className="curve-axis-labels"><span>暗部</span><span>输入亮度</span><span>亮部</span></div>
    </div>
  );
}
