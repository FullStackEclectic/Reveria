import React from "react";
import { assetUrl } from "../../utils";
import type { RetouchSettings } from "./editorConstants";
import { hasBurnedWatermark } from "./retouch/settings";

export function WatermarkPreview({ settings, hidden }: { settings: RetouchSettings; hidden: boolean }) {
  if (hidden || !hasBurnedWatermark(settings)) return null;
  const imageUrl = settings.watermark_image_url ? assetUrl(settings.watermark_image_url) : "";
  return (
    <div className={`watermark-preview ${settings.watermark_position}`} aria-hidden="true">
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          style={{
            opacity: settings.watermark_opacity / 100,
            width: `clamp(28px, ${settings.watermark_size * 1.6}vw, 220px)`,
          }}
        />
      )}
      {settings.watermark_text && (
        <span style={{ color: settings.watermark_color, opacity: settings.watermark_opacity / 100,
          fontSize: `clamp(10px, ${settings.watermark_size * 0.3}vw, 64px)` }}>
          {settings.watermark_text}
        </span>
      )}
    </div>
  );
}
