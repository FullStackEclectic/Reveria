import React, { useState } from "react";
import { RetouchSettings } from "./editorConstants";

interface Props {
  settings: RetouchSettings;
  handleSliderChange: (key: keyof RetouchSettings, val: number) => void;
  handleAutoSave: () => void;
}

type Channel = "red" | "orange" | "yellow" | "green" | "aqua" | "blue" | "purple" | "magenta";

const CHANNELS: Array<{ key: Channel; label: string; color: string }> = [
  { key: "red",     label: "红", color: "#ef4444" },
  { key: "orange",  label: "橙", color: "#f97316" },
  { key: "yellow",  label: "黄", color: "#eab308" },
  { key: "green",   label: "绿", color: "#22c55e" },
  { key: "aqua",    label: "青", color: "#06b6d4" },
  { key: "blue",    label: "蓝", color: "#3b82f6" },
  { key: "purple",  label: "紫", color: "#a855f7" },
  { key: "magenta", label: "洋红", color: "#ec4899" },
];

function Slider({
  label, value, min, max,
  onChange, onMouseUp,
}: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void; onMouseUp: () => void;
}) {
  const display = value > 0 ? `+${value}` : `${value}`;
  return (
    <div className="slider-item">
      <div className="slider-label">
        <span>{label}</span>
        <span className="value">{display}</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onMouseUp}
      />
    </div>
  );
}

export function HslAdjustments({ settings, handleSliderChange, handleAutoSave }: Props) {
  const [activeChannel, setActiveChannel] = useState<Channel>("red");

  const bind = (channel: Channel, prop: "h" | "s" | "l") => {
    const key = `hsl_${channel}_${prop}` as keyof RetouchSettings;
    return {
      value: settings[key] as number,
      min: -100,
      max: 100,
      onChange: (v: number) => handleSliderChange(key, v),
      onMouseUp: handleAutoSave,
    };
  };

  return (
    <div className="hsl-adjustments">
      <div className="hsl-channel-selector">
        {CHANNELS.map((ch) => (
          <button
            key={ch.key}
            className={`channel-btn ${activeChannel === ch.key ? "active" : ""}`}
            onClick={() => setActiveChannel(ch.key)}
            style={{
              borderColor: activeChannel === ch.key ? ch.color : "transparent",
              color: activeChannel === ch.key ? ch.color : "#a1a1aa"
            }}
          >
            {ch.label}
          </button>
        ))}
      </div>
      <div className="hsl-sliders">
        <Slider label="色相 Hue" {...bind(activeChannel, "h")} />
        <Slider label="饱和度 Saturation" {...bind(activeChannel, "s")} />
        <Slider label="明度 Luminance" {...bind(activeChannel, "l")} />
      </div>
    </div>
  );
}
