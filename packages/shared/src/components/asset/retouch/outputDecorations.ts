import { assetUrl } from "../../../utils";
import type { RetouchSettings, WatermarkPosition } from "./settings";
import { hasBurnedWatermark } from "./settings";
import { hasActiveOverlays } from "./overlays";
import { compositeOverlaysOnto } from "./overlayComposite";

interface WatermarkLayout {
  x: number;
  y: number;
  align: CanvasTextAlign;
  baseline: CanvasTextBaseline;
}

const WATERMARK_IMAGE_MAX_EDGE = 256;

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

function loadWatermarkImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("水印图片加载失败"));
    image.src = assetUrl(url);
  });
}

function imageDrawRect(
  layout: WatermarkLayout,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  const x = layout.align === "right" ? layout.x - width
    : layout.align === "center" ? layout.x - width / 2
    : layout.x;
  const y = layout.baseline === "bottom" ? layout.y - height
    : layout.baseline === "middle" ? layout.y - height / 2
    : layout.y;
  return { x, y, width, height };
}

/** 将用户选择的水印图缩小为 PNG data URL，避免把原图塞进 advanced_json。 */
export async function encodeWatermarkImageFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, WATERMARK_IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("无法读取水印图片");
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/png");
}

function paintWatermark(
  context: CanvasRenderingContext2D,
  settings: RetouchSettings,
  output: HTMLCanvasElement,
  image: HTMLImageElement | null,
) {
  const shortSide = Math.max(1, Math.min(output.width, output.height));
  const margin = Math.max(12, Math.round(shortSide * 0.035));
  const layout = watermarkLayout(settings.watermark_position, output.width, output.height, margin);
  context.save();
  context.globalAlpha = settings.watermark_opacity * 0.01;

  if (image && image.naturalWidth > 0) {
    const markWidth = Math.max(24, Math.round(shortSide * settings.watermark_size * 0.04));
    const markHeight = Math.max(1, Math.round(markWidth * (image.naturalHeight / image.naturalWidth)));
    const rect = imageDrawRect(layout, markWidth, markHeight);
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  }

  if (settings.watermark_text) {
    const fontSize = Math.max(10, Math.round(shortSide * settings.watermark_size * 0.01));
    context.fillStyle = settings.watermark_color;
    context.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    context.textAlign = layout.align;
    context.textBaseline = layout.baseline;
    context.shadowColor = "rgba(0, 0, 0, 0.45)";
    context.shadowBlur = Math.max(2, fontSize * 0.12);
    context.fillText(settings.watermark_text, layout.x, layout.y, output.width - margin * 2);
  }
  context.restore();
}

export async function exportDecoratedCanvas(
  source: HTMLCanvasElement,
  settings: RetouchSettings,
  format: "jpeg" | "png" | "webp",
  quality: number,
): Promise<string> {
  const needsWatermark = hasBurnedWatermark(settings);
  const needsOverlay = hasActiveOverlays(settings.overlays);
  if (!needsWatermark && !needsOverlay) {
    return source.toDataURL(`image/${format}`, quality);
  }

  const output = document.createElement("canvas");
  output.width = source.width;
  output.height = source.height;
  const context = output.getContext("2d");
  if (!context) return source.toDataURL(`image/${format}`, quality);
  context.drawImage(source, 0, 0);
  if (needsOverlay) compositeOverlaysOnto(output, settings.overlays);

  if (!needsWatermark) {
    return output.toDataURL(`image/${format}`, quality);
  }

  let image: HTMLImageElement | null = null;
  if (settings.watermark_image_url) {
    try {
      image = await loadWatermarkImage(settings.watermark_image_url);
    } catch {
      image = null;
    }
  }
  paintWatermark(context, settings, output, image);
  return output.toDataURL(`image/${format}`, quality);
}
