import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./settings";
import { buildNativeExportSettings } from "./nativeExport";

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
});
