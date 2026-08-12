import {
  PORTRAIT_PARAM_KEYS,
  type PortraitParamKey,
} from "./portraitParams";
import type { RetouchSettings } from "./settings";

export type NativeExportFormat = "jpeg" | "png" | "webp";

const NATIVE_PORTRAIT_KEYS = new Set<PortraitParamKey>([
  "blur_strength",
  "neutral_gray_smooth",
  "skin_texture",
  "skin_whiten",
  "skin_highlight",
]);

const NATIVE_SETTING_KEYS = [
  "exposure", "contrast", "highlights", "shadows", "whites", "blacks",
  "saturation", "vibrance", "temperature", "tint", "dehaze", "clarity", "sharpness",
  "rotation", "flip_horizontal", "flip_vertical", "crop_x", "crop_y", "crop_width", "crop_height",
  "hsl_red_h", "hsl_red_s", "hsl_red_l",
  "hsl_orange_h", "hsl_orange_s", "hsl_orange_l",
  "hsl_yellow_h", "hsl_yellow_s", "hsl_yellow_l",
  "hsl_green_h", "hsl_green_s", "hsl_green_l",
  "hsl_aqua_h", "hsl_aqua_s", "hsl_aqua_l",
  "hsl_blue_h", "hsl_blue_s", "hsl_blue_l",
  "hsl_purple_h", "hsl_purple_s", "hsl_purple_l",
  "hsl_magenta_h", "hsl_magenta_s", "hsl_magenta_l",
  "curve_rgb", "curve_red", "curve_green", "curve_blue",
  "shadow_tone_hue", "shadow_tone_saturation",
  "highlight_tone_hue", "highlight_tone_saturation", "tone_balance",
  "blur_strength", "neutral_gray_smooth", "skin_texture", "skin_whiten", "skin_highlight",
] as const satisfies readonly (keyof RetouchSettings)[];

export interface NativeExportSettings extends Record<string, unknown> {
  lut_path: string;
  lut_intensity: number;
  output_quality: number;
}

/**
 * 返回 Rust 引擎可无损复现的参数；返回 null 时必须使用 WebGL 最终画面导出。
 * 人脸关键点、画笔纹理和浏览器内 LUT 当前无法跨 ABI 传递，因此不冒险生成不一致成品。
 */
export function buildNativeExportSettings(
  settings: RetouchSettings,
  format: NativeExportFormat,
): NativeExportSettings | null {
  if (
    settings.healing_spots.length > 0
    || settings.clone_stamps.length > 0
    || settings.liquify_strokes.length > 0
    || settings.local_masks.length > 0
    || settings.background_mode !== "original"
    || settings.lut_file !== ""
  ) {
    return null;
  }
  const hasUnsupportedPortraitEffect = PORTRAIT_PARAM_KEYS.some(
    (key) => !NATIVE_PORTRAIT_KEYS.has(key) && Math.abs(settings[key]) > 0.0001,
  );
  if (hasUnsupportedPortraitEffect) return null;

  const result: Record<string, unknown> = {};
  for (const key of NATIVE_SETTING_KEYS) {
    result[key] = settings[key];
  }
  return {
    ...result,
    lut_path: "",
    lut_intensity: settings.lut_intensity,
    output_quality: format === "jpeg" ? 95 : 100,
  } as NativeExportSettings;
}
