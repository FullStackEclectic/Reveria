import type { OverlayLayer, OverlayPresetId } from "./overlays";

function fillRadial(
  context: CanvasRenderingContext2D,
  x: number, y: number, inner: number, outer: number, color: string,
) {
  const gradient = context.createRadialGradient(x, y, inner, x, y, outer);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);
}

export function drawPresetOverlay(
  context: CanvasRenderingContext2D,
  preset: OverlayPresetId,
  width: number,
  height: number,
) {
  context.clearRect(0, 0, width, height);
  if (preset === "leak-warm") {
    fillRadial(context, width * 0.08, height * 0.12, 0, Math.max(width, height) * 0.55, "rgba(255,120,40,0.85)");
    fillRadial(context, width * 0.92, height * 0.88, 0, Math.max(width, height) * 0.4, "rgba(255,60,90,0.55)");
    return;
  }
  if (preset === "leak-cool") {
    fillRadial(context, width * 0.9, height * 0.1, 0, Math.max(width, height) * 0.5, "rgba(80,180,255,0.8)");
    fillRadial(context, width * 0.15, height * 0.85, 0, Math.max(width, height) * 0.35, "rgba(140,80,255,0.5)");
    return;
  }
  if (preset === "flare") {
    const cx = width * 0.72;
    const cy = height * 0.22;
    fillRadial(context, cx, cy, 0, Math.min(width, height) * 0.18, "rgba(255,255,240,0.95)");
    context.save();
    context.translate(cx, cy);
    context.rotate(-0.4);
    const streak = context.createLinearGradient(-width, 0, width, 0);
    streak.addColorStop(0, "rgba(255,220,120,0)");
    streak.addColorStop(0.5, "rgba(255,240,200,0.65)");
    streak.addColorStop(1, "rgba(255,220,120,0)");
    context.fillStyle = streak;
    context.fillRect(-width, -Math.max(2, height * 0.012), width * 2, Math.max(4, height * 0.024));
    context.restore();
    for (const offset of [-0.18, 0.12, 0.28]) {
      fillRadial(context, cx + width * offset, cy + height * offset * 0.35, 0, Math.min(width, height) * 0.06, "rgba(255,180,80,0.45)");
    }
    return;
  }
  if (preset === "sky-dusk" || preset === "sky-blue") {
    const gradient = context.createLinearGradient(0, 0, 0, height * 0.62);
    if (preset === "sky-dusk") {
      gradient.addColorStop(0, "rgba(255,120,70,0.85)");
      gradient.addColorStop(0.45, "rgba(120,60,140,0.55)");
      gradient.addColorStop(1, "rgba(20,20,40,0)");
    } else {
      gradient.addColorStop(0, "rgba(90,170,255,0.8)");
      gradient.addColorStop(0.55, "rgba(180,220,255,0.35)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
    }
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    return;
  }
  if (preset === "clouds") {
    context.fillStyle = "rgba(255,255,255,0.18)";
    const blobs = [
      [0.2, 0.12, 0.22], [0.45, 0.08, 0.28], [0.7, 0.14, 0.2], [0.38, 0.2, 0.16],
    ];
    for (const [nx, ny, nr] of blobs) {
      context.beginPath();
      context.ellipse(width * nx, height * ny, width * nr, height * nr * 0.35, 0, 0, Math.PI * 2);
      context.fill();
    }
    return;
  }
  context.fillStyle = "rgba(255,255,230,0.9)";
  for (let index = 0; index < 90; index += 1) {
    const seed = (index * 137.508) % 1;
    const x = ((index * 97) % 1000) / 1000 * width;
    const y = ((index * 53) % 1000) / 1000 * height;
    const size = 0.4 + seed * 1.8;
    context.globalAlpha = 0.15 + seed * 0.55;
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

export function drawGradientOverlay(context: CanvasRenderingContext2D, layer: OverlayLayer, width: number, height: number) {
  context.clearRect(0, 0, width, height);
  if (layer.gradient_type === "radial") {
    const gradient = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.65);
    gradient.addColorStop(0, layer.gradient_from);
    gradient.addColorStop(1, layer.gradient_to);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    return;
  }
  const angle = (layer.gradient_angle - 90) * Math.PI / 180;
  const cx = width / 2;
  const cy = height / 2;
  const length = Math.hypot(width, height) / 2;
  const gradient = context.createLinearGradient(
    cx - Math.cos(angle) * length, cy - Math.sin(angle) * length,
    cx + Math.cos(angle) * length, cy + Math.sin(angle) * length,
  );
  gradient.addColorStop(0, layer.gradient_from);
  gradient.addColorStop(1, layer.gradient_to);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

export function drawTextOverlay(context: CanvasRenderingContext2D, layer: OverlayLayer, width: number, height: number) {
  context.clearRect(0, 0, width, height);
  const text = layer.text.trim();
  if (!text) return;
  const shortSide = Math.max(1, Math.min(width, height));
  const fontSize = Math.max(10, Math.round(shortSide * layer.font_size * 0.01));
  const italic = layer.italic ? "italic " : "";
  context.font = `${italic}${layer.font_weight} ${fontSize}px ${layer.font_family}`;
  context.fillStyle = layer.color;
  context.textAlign = layer.align;
  context.textBaseline = "middle";
  const tracking = fontSize * layer.tracking * 0.01;
  const warp = layer.warp / 100;
  const originX = layer.x * width;
  const originY = layer.y * height;
  context.save();
  context.translate(originX, originY);
  context.rotate(layer.rotation * Math.PI / 180);
  if (Math.abs(warp) < 0.01 && Math.abs(tracking) < 0.2) {
    context.fillText(text, 0, 0);
    context.restore();
    return;
  }
  const chars = [...text];
  const widths = chars.map((char) => context.measureText(char).width + tracking);
  const total = widths.reduce((sum, value) => sum + value, 0);
  let cursor = layer.align === "left" ? 0 : layer.align === "right" ? -total : -total / 2;
  const radius = Math.max(fontSize * 4, shortSide * 0.35);
  chars.forEach((char, index) => {
    const center = cursor + widths[index] / 2;
    const offsetY = warp * radius * (1 - Math.cos(center / radius));
    context.fillText(char, center, offsetY);
    cursor += widths[index];
  });
  context.restore();
}

export function drawDuotoneOverlay(
  context: CanvasRenderingContext2D,
  layer: OverlayLayer,
  source: HTMLCanvasElement,
) {
  const width = source.width;
  const height = source.height;
  context.clearRect(0, 0, width, height);
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) return;
  const pixels = sourceContext.getImageData(0, 0, width, height);
  const shadow = parseHex(layer.duotone_shadow);
  const highlight = parseHex(layer.duotone_highlight);
  const data = pixels.data;
  for (let index = 0; index < data.length; index += 4) {
    const luma = (data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114) / 255;
    data[index] = shadow[0] + (highlight[0] - shadow[0]) * luma;
    data[index + 1] = shadow[1] + (highlight[1] - shadow[1]) * luma;
    data[index + 2] = shadow[2] + (highlight[2] - shadow[2]) * luma;
  }
  context.putImageData(pixels, 0, 0);
}

function parseHex(value: string): [number, number, number] {
  const encoded = Number.parseInt(value.slice(1), 16);
  return [(encoded >> 16) & 255, (encoded >> 8) & 255, encoded & 255];
}
