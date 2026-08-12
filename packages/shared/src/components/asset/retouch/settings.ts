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
export type BackgroundMode = "original" | "transparent" | "solid" | "blur" | "image";
export type LocalMaskType = "brush" | "linear" | "radial" | "color" | "luminance";
export type WatermarkPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";

export interface LocalMaskPoint {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  erase: boolean;
}

export interface LocalMaskAdjustments {
  exposure: number;
  contrast: number;
  saturation: number;
  temperature: number;
  tint: number;
}

export interface LocalMask {
  id: string;
  name: string;
  type: LocalMaskType;
  enabled: boolean;
  inverted: boolean;
  opacity: number;
  feather: number;
  points: LocalMaskPoint[];
  start_x: number;
  start_y: number;
  end_x: number;
  end_y: number;
  center_x: number;
  center_y: number;
  radius_x: number;
  radius_y: number;
  rotation: number;
  color_hue: number;
  color_range: number;
  color_saturation_min: number;
  luminance_min: number;
  luminance_max: number;
  edge_aware: boolean;
  edge_tolerance: number;
  sample_hue: number;
  sample_saturation: number;
  sample_luminance: number;
  adjustments: LocalMaskAdjustments;
}

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
export const MAX_LOCAL_MASKS = 6;
export const MAX_LOCAL_MASK_POINTS = 1200;
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
  grain_amount: number;  // 0 ~ 100
  grain_size: number;    // 1 ~ 100
  grain_roughness: number; // 0 ~ 100
  // 镜头与画面效果
  lens_distortion: number; // -100 ~ 100，负=桶形，正=枕形
  vignette_amount: number; // -100 ~ 100，正=压暗，负=提亮
  vignette_midpoint: number; // 0 ~ 100
  vignette_feather: number; // 0 ~ 100
  vignette_roundness: number; // -100 ~ 100
  // 身体塑形：位置参数使全身塑形适配不同构图，而非依赖固定人像位置
  body_center_x: number;  // 0 ~ 100
  body_waist_y: number;   // 0 ~ 100
  body_waist: number;     // -100 ~ 100
  body_shoulders: number; // -100 ~ 100
  body_hips: number;      // -100 ~ 100
  body_legs: number;      // -100 ~ 100
  body_leg_length: number; // -100 ~ 100
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
  // 局部蒙版调色：每个蒙版拥有独立选区参数与调色参数。
  local_masks: LocalMask[];
  // AI 抠图与背景合成。cutout_url 指向带 alpha 的前景 PNG，作为持久化蒙版来源。
  background_cutout_url: string;
  background_mode: BackgroundMode;
  background_color: string;
  background_blur: number;
  background_image_url: string;
  background_image_scale: number;
  background_image_x: number;
  background_image_y: number;
  // 输出装饰
  watermark_enabled: number;
  watermark_text: string;
  watermark_opacity: number;
  watermark_size: number;
  watermark_position: WatermarkPosition;
  watermark_color: string;
  border_enabled: number;
  border_size: number;
  border_radius: number;
  border_color: string;
  preserve_exif: number;
}

export const DEFAULT_SETTINGS: RetouchSettings = {
  ...DEFAULT_PORTRAIT_PARAMS,
  exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
  saturation: 0, vibrance: 0, temperature: 0, tint: 0, dehaze: 0,
  clarity: 0, sharpness: 0,
  grain_amount: 0, grain_size: 35, grain_roughness: 50,
  lens_distortion: 0,
  vignette_amount: 0, vignette_midpoint: 50, vignette_feather: 65, vignette_roundness: 0,
  body_center_x: 50, body_waist_y: 52,
  body_waist: 0, body_shoulders: 0, body_hips: 0, body_legs: 0, body_leg_length: 0,
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
  local_masks: [],
  background_cutout_url: "",
  background_mode: "original",
  background_color: "#ffffff",
  background_blur: 18,
  background_image_url: "",
  background_image_scale: 1,
  background_image_x: 0,
  background_image_y: 0,
  watermark_enabled: 0,
  watermark_text: "",
  watermark_opacity: 65,
  watermark_size: 4,
  watermark_position: "bottom-right",
  watermark_color: "#ffffff",
  border_enabled: 0,
  border_size: 3,
  border_radius: 0,
  border_color: "#ffffff",
  preserve_exif: 1,
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

const LOCAL_MASK_TYPES = new Set<LocalMaskType>(["brush", "linear", "radial", "color", "luminance"]);

function normalizeLocalMaskPoints(value: unknown): LocalMaskPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((point): point is LocalMaskPoint => point != null && typeof point === "object"
      && [point.x, point.y, point.radius, point.opacity]
        .every((item) => typeof item === "number" && Number.isFinite(item)))
    .slice(-MAX_LOCAL_MASK_POINTS)
    .map((point) => ({
      x: clamp(point.x, 0, 1),
      y: clamp(point.y, 0, 1),
      radius: clamp(point.radius, 0.002, 0.35),
      opacity: clamp(point.opacity, 0, 1),
      erase: point.erase === true,
    }));
}

function normalizeLocalAdjustments(value: unknown): LocalMaskAdjustments {
  const source = value != null && typeof value === "object"
    ? value as Partial<LocalMaskAdjustments>
    : {};
  const read = (key: keyof LocalMaskAdjustments) => {
    const raw = source[key];
    return typeof raw === "number" && Number.isFinite(raw) ? clamp(raw, -100, 100) : 0;
  };
  return {
    exposure: read("exposure"),
    contrast: read("contrast"),
    saturation: read("saturation"),
    temperature: read("temperature"),
    tint: read("tint"),
  };
}

function normalizeLocalMasks(value: unknown): LocalMask[] {
  if (!Array.isArray(value)) return [];
  const usedIDs = new Set<string>();
  return value
    .filter((mask) => mask != null && typeof mask === "object")
    .slice(-MAX_LOCAL_MASKS)
    .map((raw, index) => {
      const mask = raw as Partial<LocalMask>;
      const rawID = typeof mask.id === "string" ? mask.id.trim().slice(0, 80) : "";
      const id = rawID && !usedIDs.has(rawID) ? rawID : `local-mask-${index + 1}`;
      usedIDs.add(id);
      const type = typeof mask.type === "string" && LOCAL_MASK_TYPES.has(mask.type as LocalMaskType)
        ? mask.type as LocalMaskType
        : "brush";
      const number = (key: keyof LocalMask, fallback: number, min: number, max: number) => {
        const rawValue = mask[key];
        return typeof rawValue === "number" && Number.isFinite(rawValue)
          ? clamp(rawValue, min, max)
          : fallback;
      };
      const luminanceMin = number("luminance_min", 0.2, 0, 1);
      const luminanceMax = Math.max(luminanceMin, number("luminance_max", 0.8, 0, 1));
      return {
        id,
        name: typeof mask.name === "string" && mask.name.trim() ? mask.name.trim().slice(0, 40) : `局部蒙版 ${index + 1}`,
        type,
        enabled: mask.enabled !== false,
        inverted: mask.inverted === true,
        opacity: number("opacity", 1, 0, 1),
        feather: number("feather", 0.35, 0.001, 1),
        points: type === "brush" ? normalizeLocalMaskPoints(mask.points) : [],
        start_x: number("start_x", 0.25, 0, 1),
        start_y: number("start_y", 0.5, 0, 1),
        end_x: number("end_x", 0.75, 0, 1),
        end_y: number("end_y", 0.5, 0, 1),
        center_x: number("center_x", 0.5, 0, 1),
        center_y: number("center_y", 0.5, 0, 1),
        radius_x: number("radius_x", 0.3, 0.01, 1),
        radius_y: number("radius_y", 0.3, 0.01, 1),
        rotation: number("rotation", 0, -180, 180),
        color_hue: number("color_hue", 0, 0, 360),
        color_range: number("color_range", 30, 1, 180),
        color_saturation_min: number("color_saturation_min", 0.1, 0, 1),
        luminance_min: luminanceMin,
        luminance_max: luminanceMax,
        edge_aware: mask.edge_aware !== false,
        edge_tolerance: number("edge_tolerance", 0.22, 0.02, 1),
        sample_hue: number("sample_hue", 0, 0, 1),
        sample_saturation: number("sample_saturation", 0, 0, 1),
        sample_luminance: number("sample_luminance", 0.5, 0, 1),
        adjustments: normalizeLocalAdjustments(mask.adjustments),
      };
    });
}

const BACKGROUND_MODES = new Set<BackgroundMode>(["original", "transparent", "solid", "blur", "image"]);
const WATERMARK_POSITIONS = new Set<WatermarkPosition>([
  "top-left", "top-right", "bottom-left", "bottom-right", "center",
]);

function normalizeBackgroundMode(value: unknown, cutoutURL: string): BackgroundMode {
  if (!cutoutURL) return "original";
  return typeof value === "string" && BACKGROUND_MODES.has(value as BackgroundMode)
    ? value as BackgroundMode
    : "transparent";
}

function normalizeHexColor(value: unknown): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : "#ffffff";
}

function finiteClamped(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value) ? clamp(value, min, max) : fallback;
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
  const backgroundCutoutURL = typeof merged.background_cutout_url === "string"
    ? merged.background_cutout_url.trim()
    : "";
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
    local_masks: normalizeLocalMasks(merged.local_masks),
    background_cutout_url: backgroundCutoutURL,
    background_mode: normalizeBackgroundMode(merged.background_mode, backgroundCutoutURL),
    background_color: normalizeHexColor(merged.background_color),
    background_blur: Number.isFinite(merged.background_blur) ? clamp(merged.background_blur, 0, 40) : 18,
    background_image_url: typeof merged.background_image_url === "string" ? merged.background_image_url.trim() : "",
    background_image_scale: Number.isFinite(merged.background_image_scale)
      ? clamp(merged.background_image_scale, 0.5, 3)
      : 1,
    background_image_x: Number.isFinite(merged.background_image_x) ? clamp(merged.background_image_x, -1, 1) : 0,
    background_image_y: Number.isFinite(merged.background_image_y) ? clamp(merged.background_image_y, -1, 1) : 0,
    grain_amount: finiteClamped(merged.grain_amount, 0, 0, 100),
    grain_size: finiteClamped(merged.grain_size, 35, 1, 100),
    grain_roughness: finiteClamped(merged.grain_roughness, 50, 0, 100),
    lens_distortion: finiteClamped(merged.lens_distortion, 0, -100, 100),
    vignette_amount: finiteClamped(merged.vignette_amount, 0, -100, 100),
    vignette_midpoint: finiteClamped(merged.vignette_midpoint, 50, 0, 100),
    vignette_feather: finiteClamped(merged.vignette_feather, 65, 0, 100),
    vignette_roundness: finiteClamped(merged.vignette_roundness, 0, -100, 100),
    body_center_x: finiteClamped(merged.body_center_x, 50, 0, 100),
    body_waist_y: finiteClamped(merged.body_waist_y, 52, 10, 90),
    body_waist: finiteClamped(merged.body_waist, 0, -100, 100),
    body_shoulders: finiteClamped(merged.body_shoulders, 0, -100, 100),
    body_hips: finiteClamped(merged.body_hips, 0, -100, 100),
    body_legs: finiteClamped(merged.body_legs, 0, -100, 100),
    body_leg_length: finiteClamped(merged.body_leg_length, 0, -100, 100),
    watermark_enabled: finiteClamped(merged.watermark_enabled, 0, 0, 1) >= 0.5 ? 1 : 0,
    watermark_text: typeof merged.watermark_text === "string" ? merged.watermark_text.trim().slice(0, 120) : "",
    watermark_opacity: finiteClamped(merged.watermark_opacity, 65, 0, 100),
    watermark_size: finiteClamped(merged.watermark_size, 4, 1, 15),
    watermark_position: typeof merged.watermark_position === "string"
      && WATERMARK_POSITIONS.has(merged.watermark_position as WatermarkPosition)
      ? merged.watermark_position as WatermarkPosition
      : "bottom-right",
    watermark_color: normalizeHexColor(merged.watermark_color),
    border_enabled: finiteClamped(merged.border_enabled, 0, 0, 1) >= 0.5 ? 1 : 0,
    border_size: finiteClamped(merged.border_size, 3, 0, 20),
    border_radius: finiteClamped(merged.border_radius, 0, 0, 50),
    border_color: normalizeHexColor(merged.border_color),
    preserve_exif: finiteClamped(merged.preserve_exif, 1, 0, 1) >= 0.5 ? 1 : 0,
  };
}
