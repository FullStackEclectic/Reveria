import React from "react";

interface SliderItemProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  onAutoSave?: () => void;
  highlight?: boolean;
  min?: number;
  max?: number;
}

/**
 * 通用的滑块调节项组件，用于人像调整面板中的各类参数微调
 */
export function SliderItem({
  label, value, onChange, onAutoSave, highlight, min = 0, max = 100,
}: SliderItemProps) {
  return (
    <div className="slider-item">
      <div className="slider-label">
        <span className={highlight ? "highlight-dot" : undefined}>{label}</span>
        <span className="value">{value}</span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onAutoSave}
        onTouchEnd={onAutoSave}
      />
    </div>
  );
}
