import type { RetouchSettings, WatermarkPosition } from "./settings";

interface WatermarkLayout {
  x: number;
  y: number;
  align: CanvasTextAlign;
  baseline: CanvasTextBaseline;
}

function watermarkLayout(
  position: WatermarkPosition,
  width: number,
  height: number,
  margin: number,
): WatermarkLayout {
  if (position === "top-left") return { x: margin, y: margin, align: "left", baseline: "top" };
  if (position === "top-right") return { x: width - margin, y: margin, align: "right", baseline: "top" };
  if (position === "bottom-left") return { x: margin, y: height - margin, align: "left", baseline: "bottom" };
  if (position === "center") return { x: width / 2, y: height / 2, align: "center", baseline: "middle" };
  return { x: width - margin, y: height - margin, align: "right", baseline: "bottom" };
}

export function exportDecoratedCanvas(
  source: HTMLCanvasElement,
  settings: RetouchSettings,
  format: "jpeg" | "png" | "webp",
  quality: number,
): string {
  if (!settings.watermark_enabled || !settings.watermark_text) {
    return source.toDataURL(`image/${format}`, quality);
  }

  const output = document.createElement("canvas");
  output.width = source.width;
  output.height = source.height;
  const context = output.getContext("2d");
  if (!context) return source.toDataURL(`image/${format}`, quality);
  context.drawImage(source, 0, 0);

  const shortSide = Math.max(1, Math.min(output.width, output.height));
  const fontSize = Math.max(10, Math.round(shortSide * settings.watermark_size * 0.01));
  const margin = Math.max(12, Math.round(shortSide * 0.035));
  const layout = watermarkLayout(settings.watermark_position, output.width, output.height, margin);
  context.save();
  context.globalAlpha = settings.watermark_opacity * 0.01;
  context.fillStyle = settings.watermark_color;
  context.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  context.textAlign = layout.align;
  context.textBaseline = layout.baseline;
  context.shadowColor = "rgba(0, 0, 0, 0.45)";
  context.shadowBlur = Math.max(2, fontSize * 0.12);
  context.fillText(settings.watermark_text, layout.x, layout.y, output.width - margin * 2);
  context.restore();
  return output.toDataURL(`image/${format}`, quality);
}
