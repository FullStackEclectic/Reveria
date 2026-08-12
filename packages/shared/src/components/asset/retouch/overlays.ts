export const BLEND_MODES = [
  "normal", "multiply", "screen", "overlay",
  "soft-light", "hard-light", "color-dodge", "color-burn",
  "darken", "lighten", "difference", "exclusion",
] as const;

export type BlendMode = typeof BLEND_MODES[number];

export const BLEND_MODE_LABELS: Record<BlendMode, string> = {
  normal: "正常",
  multiply: "正片叠底",
  screen: "滤色",
  overlay: "叠加",
  "soft-light": "柔光",
  "hard-light": "强光",
  "color-dodge": "颜色减淡",
  "color-burn": "颜色加深",
  darken: "变暗",
  lighten: "变亮",
  difference: "差值",
  exclusion: "排除",
};

export const CANVAS_BLEND: Record<BlendMode, GlobalCompositeOperation> = {
  normal: "source-over",
  multiply: "multiply",
  screen: "screen",
  overlay: "overlay",
  "soft-light": "soft-light",
  "hard-light": "hard-light",
  "color-dodge": "color-dodge",
  "color-burn": "color-burn",
  darken: "darken",
  lighten: "lighten",
  difference: "difference",
  exclusion: "exclusion",
};

export const OVERLAY_PRESETS = [
  { id: "leak-warm", label: "暖色光漏" },
  { id: "leak-cool", label: "冷色光漏" },
  { id: "flare", label: "镜头耀花" },
  { id: "sky-dusk", label: "黄昏天空" },
  { id: "sky-blue", label: "晴空" },
  { id: "clouds", label: "云层" },
  { id: "dust", label: "尘埃" },
] as const;

export type OverlayPresetId = typeof OVERLAY_PRESETS[number]["id"];
export type OverlayKind = "text" | "preset" | "gradient" | "duotone";
export type OverlayAlign = "left" | "center" | "right";
export type OverlayGradientType = "linear" | "radial";

export interface OverlayMaskPoint {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  erase: boolean;
}

export interface OverlayLayer {
  id: string;
  kind: OverlayKind;
  name: string;
  enabled: boolean;
  opacity: number;
  blend: BlendMode;
  mask_points: OverlayMaskPoint[];
  text: string;
  font_family: string;
  font_size: number;
  font_weight: number;
  italic: number;
  color: string;
  align: OverlayAlign;
  x: number;
  y: number;
  rotation: number;
  tracking: number;
  warp: number;
  preset_id: OverlayPresetId;
  gradient_from: string;
  gradient_to: string;
  gradient_angle: number;
  gradient_type: OverlayGradientType;
  duotone_shadow: string;
  duotone_highlight: string;
}

export const MAX_OVERLAYS = 8;
export const MAX_OVERLAY_MASK_POINTS = 400;

const BLEND_SET = new Set<string>(BLEND_MODES);
const PRESET_SET = new Set<string>(OVERLAY_PRESETS.map((item) => item.id));
const KIND_SET = new Set<OverlayKind>(["text", "preset", "gradient", "duotone"]);
const ALIGN_SET = new Set<OverlayAlign>(["left", "center", "right"]);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hex(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}

export function createOverlayLayer(kind: OverlayKind, index = 1): OverlayLayer {
  const names: Record<OverlayKind, string> = {
    text: `文字 ${index}`,
    preset: `叠加 ${index}`,
    gradient: `渐变 ${index}`,
    duotone: `双色调 ${index}`,
  };
  return {
    id: `overlay-${kind}-${Date.now()}-${index}`,
    kind,
    name: names[kind],
    enabled: true,
    opacity: kind === "duotone" ? 85 : 70,
    blend: kind === "preset" || kind === "gradient" ? "screen" : "normal",
    mask_points: [],
    text: kind === "text" ? "Reveria" : "",
    font_family: "system-ui, sans-serif",
    font_size: 8,
    font_weight: 600,
    italic: 0,
    color: "#ffffff",
    align: "center",
    x: 0.5,
    y: 0.5,
    rotation: 0,
    tracking: 0,
    warp: 0,
    preset_id: "leak-warm",
    gradient_from: "#ff7a18",
    gradient_to: "#005bea",
    gradient_angle: 90,
    gradient_type: "linear",
    duotone_shadow: "#1b3a4b",
    duotone_highlight: "#f2c14e",
  };
}

function normalizeMaskPoints(value: unknown): OverlayMaskPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((point): point is OverlayMaskPoint => point != null && typeof point === "object"
      && [point.x, point.y, point.radius, point.opacity]
        .every((item) => typeof item === "number" && Number.isFinite(item)))
    .slice(-MAX_OVERLAY_MASK_POINTS)
    .map((point) => ({
      x: clamp(point.x, 0, 1),
      y: clamp(point.y, 0, 1),
      radius: clamp(point.radius, 0.002, 0.4),
      opacity: clamp(point.opacity, 0, 1),
      erase: point.erase === true,
    }));
}

export function normalizeOverlayLayers(value: unknown): OverlayLayer[] {
  if (!Array.isArray(value)) return [];
  const used = new Set<string>();
  return value
    .filter((item) => item != null && typeof item === "object")
    .slice(-MAX_OVERLAYS)
    .map((raw, index) => {
      const layer = raw as Partial<OverlayLayer>;
      const kind = typeof layer.kind === "string" && KIND_SET.has(layer.kind as OverlayKind)
        ? layer.kind as OverlayKind
        : "text";
      const fallback = createOverlayLayer(kind, index + 1);
      const rawId = typeof layer.id === "string" ? layer.id.trim().slice(0, 80) : "";
      const id = rawId && !used.has(rawId) ? rawId : fallback.id;
      used.add(id);
      const number = (key: keyof OverlayLayer, min: number, max: number) => {
        const rawValue = layer[key];
        return typeof rawValue === "number" && Number.isFinite(rawValue)
          ? clamp(rawValue, min, max)
          : fallback[key] as number;
      };
      return {
        ...fallback,
        id,
        kind,
        name: typeof layer.name === "string" && layer.name.trim()
          ? layer.name.trim().slice(0, 40)
          : fallback.name,
        enabled: layer.enabled !== false,
        opacity: number("opacity", 0, 100),
        blend: typeof layer.blend === "string" && BLEND_SET.has(layer.blend)
          ? layer.blend as BlendMode
          : fallback.blend,
        mask_points: normalizeMaskPoints(layer.mask_points),
        text: typeof layer.text === "string" ? layer.text.slice(0, 200) : fallback.text,
        font_family: typeof layer.font_family === "string" && layer.font_family.trim()
          ? layer.font_family.trim().slice(0, 80)
          : fallback.font_family,
        font_size: number("font_size", 2, 32),
        font_weight: number("font_weight", 300, 900),
        italic: number("italic", 0, 1) >= 0.5 ? 1 : 0,
        color: hex(layer.color, fallback.color),
        align: typeof layer.align === "string" && ALIGN_SET.has(layer.align as OverlayAlign)
          ? layer.align as OverlayAlign
          : "center",
        x: number("x", 0, 1),
        y: number("y", 0, 1),
        rotation: number("rotation", -180, 180),
        tracking: number("tracking", -50, 100),
        warp: number("warp", -100, 100),
        preset_id: typeof layer.preset_id === "string" && PRESET_SET.has(layer.preset_id)
          ? layer.preset_id as OverlayPresetId
          : "leak-warm",
        gradient_from: hex(layer.gradient_from, fallback.gradient_from),
        gradient_to: hex(layer.gradient_to, fallback.gradient_to),
        gradient_angle: number("gradient_angle", 0, 360),
        gradient_type: layer.gradient_type === "radial" ? "radial" : "linear",
        duotone_shadow: hex(layer.duotone_shadow, fallback.duotone_shadow),
        duotone_highlight: hex(layer.duotone_highlight, fallback.duotone_highlight),
      };
    });
}

export function overlayHasContent(layer: OverlayLayer): boolean {
  if (!layer.enabled || layer.opacity <= 0) return false;
  if (layer.kind === "text") return layer.text.trim().length > 0;
  return true;
}

export function hasActiveOverlays(layers: OverlayLayer[] | undefined): boolean {
  return (layers ?? []).some(overlayHasContent);
}
