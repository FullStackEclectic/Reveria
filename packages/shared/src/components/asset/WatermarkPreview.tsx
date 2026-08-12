import React from "react";
import type { RetouchSettings } from "./editorConstants";

export function WatermarkPreview({ settings, hidden }: { settings: RetouchSettings; hidden: boolean }) {
  if (hidden || !settings.watermark_enabled || !settings.watermark_text) return null;
  return (
    <div className={`watermark-preview ${settings.watermark_position}`} aria-hidden="true">
      <span style={{ color: settings.watermark_color, opacity: settings.watermark_opacity / 100,
        fontSize: `clamp(10px, ${settings.watermark_size * 0.3}vw, 64px)` }}>
        {settings.watermark_text}
      </span>
    </div>
  );
}
