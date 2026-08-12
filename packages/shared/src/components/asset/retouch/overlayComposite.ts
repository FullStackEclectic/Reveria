import {
  CANVAS_BLEND,
  overlayHasContent,
  type OverlayLayer,
  type OverlayMaskPoint,
} from "./overlays";
import {
  drawDuotoneOverlay,
  drawGradientOverlay,
  drawPresetOverlay,
  drawTextOverlay,
} from "./overlayPresets";

function applyMask(context: CanvasRenderingContext2D, points: OverlayMaskPoint[], width: number, height: number) {
  if (points.length === 0) return;
  const mask = document.createElement("canvas");
  mask.width = width;
  mask.height = height;
  const maskContext = mask.getContext("2d");
  if (!maskContext) return;
  maskContext.fillStyle = "#ffffff";
  maskContext.fillRect(0, 0, width, height);
  for (const point of points) {
    const radius = Math.max(1, point.radius * Math.min(width, height));
    maskContext.globalCompositeOperation = point.erase ? "destination-out" : "source-over";
    const gradient = maskContext.createRadialGradient(
      point.x * width, point.y * height, 0,
      point.x * width, point.y * height, radius,
    );
    gradient.addColorStop(0, `rgba(0,0,0,${point.opacity})`);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    maskContext.fillStyle = gradient;
    maskContext.beginPath();
    maskContext.arc(point.x * width, point.y * height, radius, 0, Math.PI * 2);
    maskContext.fill();
  }
  context.globalCompositeOperation = "destination-in";
  context.drawImage(mask, 0, 0);
  context.globalCompositeOperation = "source-over";
}

export function renderOverlayLayer(
  layer: OverlayLayer,
  width: number,
  height: number,
  source?: HTMLCanvasElement,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  if (layer.kind === "text") drawTextOverlay(context, layer, width, height);
  else if (layer.kind === "preset") drawPresetOverlay(context, layer.preset_id, width, height);
  else if (layer.kind === "gradient") drawGradientOverlay(context, layer, width, height);
  else if (layer.kind === "duotone") {
    if (source) drawDuotoneOverlay(context, layer, source);
    else drawGradientOverlay(context, {
      ...layer,
      gradient_from: layer.duotone_shadow,
      gradient_to: layer.duotone_highlight,
      gradient_type: "linear",
      gradient_angle: 90,
    }, width, height);
  }
  applyMask(context, layer.mask_points, width, height);
  return canvas;
}

export function compositeOverlaysOnto(target: HTMLCanvasElement, layers: OverlayLayer[]) {
  const context = target.getContext("2d");
  if (!context) return;
  const width = target.width;
  const height = target.height;
  for (const layer of layers) {
    if (!overlayHasContent(layer)) continue;
    const rendered = renderOverlayLayer(layer, width, height, target);
    context.save();
    context.globalAlpha = layer.opacity / 100;
    context.globalCompositeOperation = CANVAS_BLEND[layer.blend];
    context.drawImage(rendered, 0, 0);
    context.restore();
  }
}
