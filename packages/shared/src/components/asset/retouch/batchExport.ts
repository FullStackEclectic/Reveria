import type { ExportFormat } from "../EditorHeader";

export type BatchSettingsMode = "current" | "saved";

export const DEFAULT_BATCH_NAME_PATTERN = "{name}_retouched";

export function sanitizeExportName(value: string): string {
  const trimmed = value.trim().replace(/\.[^.]+$/, "");
  const cleaned = trimmed.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/\s+/g, " ").trim();
  return cleaned || "image";
}

export function formatBatchFilename(
  pattern: string,
  vars: { name: string; index: number; total: number },
  format: ExportFormat,
): string {
  const extension = format === "jpeg" ? "jpg" : format;
  const name = sanitizeExportName(vars.name);
  const index = String(vars.index).padStart(2, "0");
  const raw = (pattern.trim() || DEFAULT_BATCH_NAME_PATTERN)
    .split("{name}").join(name)
    .split("{index}").join(index)
    .split("{total}").join(String(vars.total));
  const base = sanitizeExportName(raw);
  return `${base}.${extension}`;
}

export function joinExportPath(directory: string, filename: string): string {
  if (!directory) return filename;
  const normalized = directory.replace(/[\\/]+$/, "");
  const separator = directory.includes("\\") ? "\\" : "/";
  return `${normalized}${separator}${filename}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败"));
    image.src = src;
  });
}

/** 按长边限制缩放；maxEdge <= 0 表示保持原尺寸。exact 用于证件照输出固定像素。 */
export async function resizeDataUrl(
  dataUrl: string,
  options: { maxEdge?: number; width?: number; height?: number; format: ExportFormat; quality?: number },
): Promise<string> {
  const image = await loadImage(dataUrl);
  let width = image.naturalWidth;
  let height = image.naturalHeight;
  if (options.width && options.height) {
    width = Math.max(1, Math.round(options.width));
    height = Math.max(1, Math.round(options.height));
  } else if (options.maxEdge && options.maxEdge > 0) {
    const longEdge = Math.max(width, height);
    if (longEdge > options.maxEdge) {
      const scale = options.maxEdge / longEdge;
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }
  }
  if (width === image.naturalWidth && height === image.naturalHeight) return dataUrl;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return dataUrl;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);
  const quality = options.format === "png" ? undefined : (options.quality ?? 0.95);
  return canvas.toDataURL(`image/${options.format}`, quality);
}
