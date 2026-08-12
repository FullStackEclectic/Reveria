import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./settings";
import { buildNativeExportSettings } from "./nativeExport";
import { createOverlayLayer } from "./overlays";

describe("buildNativeExportSettings", () => {
  it("基础调色和本地磨皮进入 Rust 全分辨率导出", () => {
    const result = buildNativeExportSettings({
      ...DEFAULT_SETTINGS,
      exposure: 18,
      blur_strength: 45,
      neutral_gray_smooth: 20,
      rotation: 1,
    }, "jpeg");
    expect(result).toMatchObject({
      exposure: 18,
      blur_strength: 45,
      neutral_gray_smooth: 20,
      rotation: 1,
      output_quality: 95,
    });
  });

  it("人脸形变使用 WebGL 回退，避免缺少关键点时结果不一致", () => {
    expect(buildNativeExportSettings({ ...DEFAULT_SETTINGS, eye_enlarge: 25 }, "png")).toBeNull();
  });

  it("局部蒙版、背景合成和浏览器 LUT 使用 WebGL 回退", () => {
    expect(buildNativeExportSettings({
      ...DEFAULT_SETTINGS,
      local_masks: [{ id: "mask" } as (typeof DEFAULT_SETTINGS.local_masks)[number]],
    }, "png")).toBeNull();
    expect(buildNativeExportSettings({
      ...DEFAULT_SETTINGS,
      background_cutout_url: "https://example.com/cutout.png",
      background_mode: "transparent",
    }, "png")).toBeNull();
    expect(buildNativeExportSettings({ ...DEFAULT_SETTINGS, lut_file: "builtin-film" }, "png")).toBeNull();
  });

  it("色散、自由变形、颗粒、暗角、畸变、塑形、边框和水印使用 WebGL 回退", () => {
    expect(buildNativeExportSettings({ ...DEFAULT_SETTINGS, fringing_amount: 12 }, "jpeg")).toBeNull();
    expect(buildNativeExportSettings({
      ...DEFAULT_SETTINGS,
      free_transform_points: [[0.1, 0], [1, 0], [1, 1], [0, 1], [0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]],
    }, "png")).toBeNull();
    expect(buildNativeExportSettings({ ...DEFAULT_SETTINGS, grain_amount: 20 }, "jpeg")).toBeNull();
    expect(buildNativeExportSettings({ ...DEFAULT_SETTINGS, vignette_amount: -15 }, "jpeg")).toBeNull();
    expect(buildNativeExportSettings({ ...DEFAULT_SETTINGS, lens_distortion: 8 }, "jpeg")).toBeNull();
    expect(buildNativeExportSettings({ ...DEFAULT_SETTINGS, body_waist: 30 }, "png")).toBeNull();
    expect(buildNativeExportSettings({ ...DEFAULT_SETTINGS, border_enabled: 1 }, "png")).toBeNull();
    expect(buildNativeExportSettings({
      ...DEFAULT_SETTINGS,
      watermark_enabled: 1,
      watermark_text: "Reveria",
    }, "jpeg")).toBeNull();
    expect(buildNativeExportSettings({
      ...DEFAULT_SETTINGS,
      watermark_enabled: 1,
      watermark_image_url: "data:image/png;base64,abc",
    }, "jpeg")).toBeNull();
    expect(buildNativeExportSettings({ ...DEFAULT_SETTINGS, luma_denoise: 20 }, "jpeg")).toBeNull();
    expect(buildNativeExportSettings({ ...DEFAULT_SETTINGS, chroma_denoise: 15 }, "jpeg")).toBeNull();
    expect(buildNativeExportSettings({ ...DEFAULT_SETTINGS, perspective_horizontal: 12 }, "jpeg")).toBeNull();
    expect(buildNativeExportSettings({ ...DEFAULT_SETTINGS, perspective_vertical: -8 }, "png")).toBeNull();
    expect(buildNativeExportSettings({
      ...DEFAULT_SETTINGS,
      overlays: [createOverlayLayer("text")],
    }, "jpeg")).toBeNull();
  });
});
