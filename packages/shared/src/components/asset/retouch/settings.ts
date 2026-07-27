import {
  DEFAULT_PORTRAIT_PARAMS,
  PORTRAIT_PARAM_KEYS,
  PORTRAIT_PARAM_MAP,
  type PortraitSettings,
} from "./portraitParams";

export type CurvePoints = [number, number, number, number, number];
export type CurveKey = "curve_rgb" | "curve_red" | "curve_green" | "curve_blue";
export interface HealingSpot { x: number; y: number; radius: number; strength: number }
export interface CloneStamp { x: number; y: number; sourceX: number; sourceY: number; radius: number; strength: number }

/** 液化笔画：0=推拉 1=收缩 2=膨胀，还原通过删除笔画实现 */
export type LiquifyMode = 0 | 1 | 2;
export interface LiquifyStroke {
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
  strength: number;
  mode: LiquifyMode;
}

export const IDENTITY_CURVE: CurvePoints = [0, 0.25, 0.5, 0.75, 1];
export const MAX_HEALING_SPOTS = 16;
export const MAX_CLONE_STAMPS = 12;
/** 液化经位移贴图叠加，笔画数不占 uniform，仅为控制存档体积设上限 */
export const MAX_LIQUIFY_STROKES = 240;
/** 位移贴图分辨率，兼顾精度与上传开销 */
export const LIQUIFY_MAP_SIZE = 128;
/** 位移贴图可编码的最大位移（UV 单位），超出部分会被截断 */
export const LIQUIFY_MAX_SHIFT = 0.12;

export interface RetouchSettings extends PortraitSettings {
  // 光影
  exposure: number;      // -100 ~ 100
  contrast: number;      // -100 ~ 100
  highlights: number;    // -100 ~ 100
  shadows: number;       // -100 ~ 100
  whites: number;        // -100 ~ 100
  blacks: number;        // -100 ~ 100
  // 色彩
  saturation: number;    // -100 ~ 100
  vibrance: number;      // -100 ~ 100
  temperature: number;   // -100 ~ 100 (负=冷蓝, 正=暖橙)
  tint: number;          // -100 ~ 100 (负=品红, 正=绿)
  dehaze: number;        // 0 ~ 100
  // 细节
  clarity: number;       // -100 ~ 100
  sharpness: number;     // 0 ~ 100
  // 几何（裁剪坐标基于旋转后的显示图像，范围 0 ~ 1）
  rotation: number;      // 0/1/2/3，对应顺时针 0/90/180/270 度
  flip_horizontal: number;
  flip_vertical: number;
  crop_x: number;
  crop_y: number;
  crop_width: number;
  crop_height: number;
  // 创意：3D LUT。lut_file 保存 LUT 标识，实际立方体数据存于 LUT 库
  lut_file: string;
  lut_intensity: number; // 0 ~ 100
  // HSL 分色调整 (8通道 × hue/saturation/luminance)
  hsl_red_h: number;     hsl_red_s: number;     hsl_red_l: number;
  hsl_orange_h: number;  hsl_orange_s: number;  hsl_orange_l: number;
  hsl_yellow_h: number;  hsl_yellow_s: number;  hsl_yellow_l: number;
  hsl_green_h: number;   hsl_green_s: number;   hsl_green_l: number;
  hsl_aqua_h: number;    hsl_aqua_s: number;    hsl_aqua_l: number;
  hsl_blue_h: number;    hsl_blue_s: number;    hsl_blue_l: number;
  hsl_purple_h: number;  hsl_purple_s: number;  hsl_purple_l: number;
  hsl_magenta_h: number; hsl_magenta_s: number; hsl_magenta_l: number;
  // RGB 曲线（固定输入点 0 / 25 / 50 / 75 / 100%，数组保存输出值）
  curve_rgb: CurvePoints;
  curve_red: CurvePoints;
  curve_green: CurvePoints;
  curve_blue: CurvePoints;
  // 色调映射
  shadow_tone_hue: number;           // 0 ~ 360
  shadow_tone_saturation: number;    // 0 ~ 100
  highlight_tone_hue: number;        // 0 ~ 360
  highlight_tone_saturation: number; // 0 ~ 100
  tone_balance: number;              // -100 ~ 100
  // 局部修复
  healing_spots: HealingSpot[];
  clone_stamps: CloneStamp[];
  liquify_strokes: LiquifyStroke[];
}

export const DEFAULT_SETTINGS: RetouchSettings = {
  ...DEFAULT_PORTRAIT_PARAMS,
  exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
  saturation: 0, vibrance: 0, temperature: 0, tint: 0, dehaze: 0,
  clarity: 0, sharpness: 0,
  rotation: 0, flip_horizontal: 0, flip_vertical: 0,
  crop_x: 0, crop_y: 0, crop_width: 1, crop_height: 1,
  lut_file: "", lut_intensity: 100,
  hsl_red_h: 0,     hsl_red_s: 0,     hsl_red_l: 0,
  hsl_orange_h: 0,  hsl_orange_s: 0,  hsl_orange_l: 0,
  hsl_yellow_h: 0,  hsl_yellow_s: 0,  hsl_yellow_l: 0,
  hsl_green_h: 0,   hsl_green_s: 0,   hsl_green_l: 0,
  hsl_aqua_h: 0,    hsl_aqua_s: 0,    hsl_aqua_l: 0,
  hsl_blue_h: 0,    hsl_blue_s: 0,    hsl_blue_l: 0,
  hsl_purple_h: 0,  hsl_purple_s: 0,  hsl_purple_l: 0,
  hsl_magenta_h: 0, hsl_magenta_s: 0, hsl_magenta_l: 0,
  curve_rgb: [...IDENTITY_CURVE],
  curve_red: [...IDENTITY_CURVE],
  curve_green: [...IDENTITY_CURVE],
  curve_blue: [...IDENTITY_CURVE],
  shadow_tone_hue: 220, shadow_tone_saturation: 0,
  highlight_tone_hue: 40, highlight_tone_saturation: 0,
  tone_balance: 0,
  healing_spots: [],
  clone_stamps: [],
  liquify_strokes: [],
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeCurve(value: unknown): CurvePoints {
  if (!Array.isArray(value) || value.length !== 5) return [...IDENTITY_CURVE];
  if (!value.every((point) => typeof point === "number" && Number.isFinite(point))) {
    return [...IDENTITY_CURVE];
  }
  return value.map((point) => clamp(point, 0, 1)) as CurvePoints;
}

function normalizeHealingSpots(value: unknown): HealingSpot[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((spot): spot is HealingSpot => spot != null && typeof spot === "object"
      && [spot.x, spot.y, spot.radius, spot.strength].every((item) => typeof item === "number" && Number.isFinite(item)))
    .slice(-MAX_HEALING_SPOTS)
    .map((spot) => ({
      x: clamp(spot.x, 0, 1),
      y: clamp(spot.y, 0, 1),
      radius: clamp(spot.radius, 0.002, 0.25),
      strength: clamp(spot.strength, 0, 1),
    }));
}

function normalizeCloneStamps(value: unknown): CloneStamp[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((stamp): stamp is CloneStamp => stamp != null && typeof stamp === "object"
      && [stamp.x, stamp.y, stamp.sourceX, stamp.sourceY, stamp.radius, stamp.strength]
        .every((item) => typeof item === "number" && Number.isFinite(item)))
    .slice(-MAX_CLONE_STAMPS)
    .map((stamp) => ({
      x: clamp(stamp.x, 0, 1), y: clamp(stamp.y, 0, 1),
      sourceX: clamp(stamp.sourceX, 0, 1), sourceY: clamp(stamp.sourceY, 0, 1),
      radius: clamp(stamp.radius, 0.002, 0.25), strength: clamp(stamp.strength, 0, 1),
    }));
}

function normalizeLiquifyStrokes(value: unknown): LiquifyStroke[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((stroke): stroke is LiquifyStroke => stroke != null && typeof stroke === "object"
      && [stroke.x, stroke.y, stroke.dx, stroke.dy, stroke.radius, stroke.strength]
        .every((item) => typeof item === "number" && Number.isFinite(item)))
    .slice(-MAX_LIQUIFY_STROKES)
    .map((stroke) => ({
      x: clamp(stroke.x, 0, 1),
      y: clamp(stroke.y, 0, 1),
      dx: clamp(stroke.dx, -LIQUIFY_MAX_SHIFT, LIQUIFY_MAX_SHIFT),
      dy: clamp(stroke.dy, -LIQUIFY_MAX_SHIFT, LIQUIFY_MAX_SHIFT),
      radius: clamp(stroke.radius, 0.005, 0.4),
      strength: clamp(stroke.strength, 0, 1),
      mode: ([0, 1, 2].includes(stroke.mode) ? stroke.mode : 0) as LiquifyMode,
    }));
}

/** 人像参数按各自量程夹取，非法值回落到 0，避免脏数据被写进 shader */
function normalizePortraitParams(merged: Partial<PortraitSettings>): PortraitSettings {
  const result: Record<string, number> = {};
  for (const key of PORTRAIT_PARAM_KEYS) {
    const meta = PORTRAIT_PARAM_MAP[key];
    const raw = merged[key];
    const value = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
    result[key] = meta.kind === "switch"
      ? (value >= 0.5 ? 1 : 0)
      : clamp(value, meta.min, meta.max);
  }
  return result as PortraitSettings;
}

export function normalizeRetouchSettings(
  settings?: Partial<RetouchSettings> | null,
): RetouchSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(settings ?? {}) };
  return {
    ...merged,
    ...normalizePortraitParams(merged),
    lut_file: typeof merged.lut_file === "string" ? merged.lut_file : "",
    lut_intensity: Number.isFinite(merged.lut_intensity) ? clamp(merged.lut_intensity, 0, 100) : 100,
    curve_rgb: normalizeCurve(merged.curve_rgb),
    curve_red: normalizeCurve(merged.curve_red),
    curve_green: normalizeCurve(merged.curve_green),
    curve_blue: normalizeCurve(merged.curve_blue),
    healing_spots: normalizeHealingSpots(merged.healing_spots),
    clone_stamps: normalizeCloneStamps(merged.clone_stamps),
    liquify_strokes: normalizeLiquifyStrokes(merged.liquify_strokes),
  };
}
