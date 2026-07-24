import React from "react";
import { RetouchSettings } from "./editorConstants";

interface Props {
  settings: RetouchSettings;
  onChange: (key: keyof RetouchSettings, value: number) => void;
  onCommit: () => void;
}

function ToneSlider({
  label, value, min, max, hue, onChange, onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  hue?: boolean;
  onChange: (value: number) => void;
  onCommit: () => void;
}) {
  return (
    <div className="slider-item tone-slider-item">
      <div className="slider-label">
        <span>{label}</span>
        <span className="value">{value}</span>
      </div>
      <input
        className={hue ? "tone-hue-slider" : undefined}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onBlur={onCommit}
      />
    </div>
  );
}

export function ToneMappingAdjustments({ settings, onChange, onCommit }: Props) {
  return (
    <div className="tone-mapping-adjustments">
      <div className="tone-channel-heading">
        <span className="tone-color-swatch" style={{ background: `hsl(${settings.shadow_tone_hue} 70% 50%)` }} />
        <span>阴影色调</span>
      </div>
      <ToneSlider label="色相" value={settings.shadow_tone_hue} min={0} max={360} hue onChange={(value) => onChange("shadow_tone_hue", value)} onCommit={onCommit} />
      <ToneSlider label="饱和度" value={settings.shadow_tone_saturation} min={0} max={100} onChange={(value) => onChange("shadow_tone_saturation", value)} onCommit={onCommit} />

      <div className="tone-channel-heading tone-highlight-heading">
        <span className="tone-color-swatch" style={{ background: `hsl(${settings.highlight_tone_hue} 70% 50%)` }} />
        <span>高光色调</span>
      </div>
      <ToneSlider label="色相" value={settings.highlight_tone_hue} min={0} max={360} hue onChange={(value) => onChange("highlight_tone_hue", value)} onCommit={onCommit} />
      <ToneSlider label="饱和度" value={settings.highlight_tone_saturation} min={0} max={100} onChange={(value) => onChange("highlight_tone_saturation", value)} onCommit={onCommit} />
      <ToneSlider label="明暗平衡" value={settings.tone_balance} min={-100} max={100} onChange={(value) => onChange("tone_balance", value)} onCommit={onCommit} />
    </div>
  );
}
