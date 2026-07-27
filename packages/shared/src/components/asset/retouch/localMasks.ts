import {
  MAX_LOCAL_MASKS,
  type LocalMask,
  type LocalMaskAdjustments,
  type LocalMaskType,
} from "./settings";

export const LOCAL_MASK_TILE_SIZE = 128;
export const LOCAL_MASK_ATLAS_COLUMNS = 3;
export const LOCAL_MASK_ATLAS_ROWS = 2;
export const LOCAL_MASK_ATLAS_WIDTH = LOCAL_MASK_TILE_SIZE * LOCAL_MASK_ATLAS_COLUMNS;
export const LOCAL_MASK_ATLAS_HEIGHT = LOCAL_MASK_TILE_SIZE * LOCAL_MASK_ATLAS_ROWS;

export const LOCAL_MASK_TYPE_CODE: Record<LocalMaskType, number> = {
  brush: 1,
  linear: 2,
  radial: 3,
  color: 4,
  luminance: 5,
};

const MASK_NAMES: Record<LocalMaskType, string> = {
  brush: "画笔蒙版",
  linear: "线性渐变",
  radial: "径向蒙版",
  color: "颜色蒙版",
  luminance: "亮度蒙版",
};

const EMPTY_ADJUSTMENTS: LocalMaskAdjustments = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
};

export function createLocalMask(type: LocalMaskType, index: number): LocalMask {
  const generatedID = globalThis.crypto?.randomUUID?.()
    ?? `local-mask-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: generatedID,
    name: `${MASK_NAMES[type]} ${index}`,
    type,
    enabled: true,
    inverted: false,
    opacity: 1,
    feather: 0.35,
    points: [],
    start_x: 0.25,
    start_y: 0.5,
    end_x: 0.75,
    end_y: 0.5,
    center_x: 0.5,
    center_y: 0.5,
    radius_x: 0.3,
    radius_y: 0.3,
    rotation: 0,
    color_hue: 0,
    color_range: 30,
    color_saturation_min: 0.1,
    luminance_min: 0.2,
    luminance_max: 0.8,
    edge_aware: true,
    edge_tolerance: 0.22,
    sample_hue: 0,
    sample_saturation: 0,
    sample_luminance: 0.5,
    adjustments: { ...EMPTY_ADJUSTMENTS },
  };
}

function paintPoint(
  pixels: Uint8Array,
  tileIndex: number,
  aspect: number,
  point: LocalMask["points"][number],
) {
  const tileX = (tileIndex % LOCAL_MASK_ATLAS_COLUMNS) * LOCAL_MASK_TILE_SIZE;
  const tileY = Math.floor(tileIndex / LOCAL_MASK_ATLAS_COLUMNS) * LOCAL_MASK_TILE_SIZE;
  const radiusY = Math.max(1, point.radius * LOCAL_MASK_TILE_SIZE);
  const radiusX = Math.max(1, radiusY / Math.max(aspect, 0.01));
  const centerX = tileX + point.x * (LOCAL_MASK_TILE_SIZE - 1);
  const centerY = tileY + point.y * (LOCAL_MASK_TILE_SIZE - 1);
  const minX = Math.max(tileX, Math.floor(centerX - radiusX));
  const maxX = Math.min(tileX + LOCAL_MASK_TILE_SIZE - 1, Math.ceil(centerX + radiusX));
  const minY = Math.max(tileY, Math.floor(centerY - radiusY));
  const maxY = Math.min(tileY + LOCAL_MASK_TILE_SIZE - 1, Math.ceil(centerY + radiusY));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = (x - centerX) / radiusX;
      const dy = (y - centerY) / radiusY;
      const distance = Math.hypot(dx, dy);
      if (distance >= 1) continue;
      const feathered = (1 - distance * distance) * point.opacity;
      const offset = (y * LOCAL_MASK_ATLAS_WIDTH + x) * 4;
      const current = pixels[offset] / 255;
      const next = point.erase
        ? current * (1 - feathered)
        : current + (1 - current) * feathered;
      const encoded = Math.round(Math.max(0, Math.min(1, next)) * 255);
      pixels[offset] = encoded;
      pixels[offset + 1] = encoded;
      pixels[offset + 2] = encoded;
      pixels[offset + 3] = 255;
    }
  }
}

/** 将全部画笔蒙版烘焙到固定 3x2 图集，其余蒙版由 Shader 解析计算。 */
export function bakeLocalMaskAtlas(masks: LocalMask[], aspect: number): Uint8Array {
  const pixels = new Uint8Array(LOCAL_MASK_ATLAS_WIDTH * LOCAL_MASK_ATLAS_HEIGHT * 4);
  for (let alpha = 3; alpha < pixels.length; alpha += 4) pixels[alpha] = 255;
  masks.slice(0, MAX_LOCAL_MASKS).forEach((mask, index) => {
    if (mask.type !== "brush") return;
    mask.points.forEach((point) => paintPoint(pixels, index, aspect, point));
  });
  return pixels;
}

export interface PackedLocalMasks {
  meta: Float32Array;
  geometryA: Float32Array;
  geometryB: Float32Array;
  range: Float32Array;
  sample: Float32Array;
  adjustmentA: Float32Array;
  adjustmentB: Float32Array;
}

export function packLocalMasks(masks: LocalMask[], showOriginal: boolean): PackedLocalMasks {
  const packed: PackedLocalMasks = {
    meta: new Float32Array(MAX_LOCAL_MASKS * 4),
    geometryA: new Float32Array(MAX_LOCAL_MASKS * 4),
    geometryB: new Float32Array(MAX_LOCAL_MASKS * 4),
    range: new Float32Array(MAX_LOCAL_MASKS * 4),
    sample: new Float32Array(MAX_LOCAL_MASKS * 4),
    adjustmentA: new Float32Array(MAX_LOCAL_MASKS * 4),
    adjustmentB: new Float32Array(MAX_LOCAL_MASKS * 4),
  };
  if (showOriginal) return packed;

  masks.slice(0, MAX_LOCAL_MASKS).forEach((mask, index) => {
    const offset = index * 4;
    packed.meta.set([
      LOCAL_MASK_TYPE_CODE[mask.type], mask.enabled ? 1 : 0, mask.opacity, mask.inverted ? 1 : 0,
    ], offset);
    packed.geometryA.set([
      mask.type === "radial" ? mask.center_x : mask.start_x,
      mask.type === "radial" ? mask.center_y : mask.start_y,
      mask.type === "radial" ? mask.radius_x : mask.end_x,
      mask.type === "radial" ? mask.radius_y : mask.end_y,
    ], offset);
    packed.geometryB.set([mask.rotation, mask.feather, 0, 0], offset);
    packed.range.set([
      mask.color_hue / 360, mask.color_range / 360, mask.luminance_min, mask.luminance_max,
    ], offset);
    packed.sample.set([
      mask.sample_hue, mask.sample_saturation, mask.sample_luminance,
      mask.edge_aware ? mask.edge_tolerance : -1,
    ], offset);
    packed.adjustmentA.set([
      mask.adjustments.exposure,
      mask.adjustments.contrast,
      mask.adjustments.saturation,
      mask.adjustments.temperature,
    ], offset);
    packed.adjustmentB.set([mask.adjustments.tint, mask.color_saturation_min, 0, 0], offset);
  });
  return packed;
}

export function rgbToHsl(red: number, green: number, blue: number): [number, number, number] {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const luminance = (max + min) / 2;
  if (max === min) return [0, 0, luminance];
  const delta = max - min;
  const saturation = luminance > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = max === red
    ? (green - blue) / delta + (green < blue ? 6 : 0)
    : max === green
      ? (blue - red) / delta + 2
      : (red - green) / delta + 4;
  hue /= 6;
  return [hue, saturation, luminance];
}
