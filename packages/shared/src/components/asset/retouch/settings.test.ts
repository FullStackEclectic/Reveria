import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  IDENTITY_CURVE,
  LIQUIFY_MAX_SHIFT,
  MAX_CLONE_STAMPS,
  MAX_HEALING_SPOTS,
  MAX_LIQUIFY_STROKES,
  MAX_LOCAL_MASKS,
  MAX_LOCAL_MASK_POINTS,
  normalizeRetouchSettings,
} from "./settings";

describe("normalizeRetouchSettings", () => {
  it("缺少存档时返回完整默认值，且曲线数组互不共享", () => {
    const first = normalizeRetouchSettings();
    const second = normalizeRetouchSettings(null);

    expect(first).toEqual(DEFAULT_SETTINGS);
    expect(second).toEqual(DEFAULT_SETTINGS);
    expect(first.curve_rgb).not.toBe(DEFAULT_SETTINGS.curve_rgb);
    expect(first.curve_rgb).not.toBe(second.curve_rgb);
  });

  it("JSON 序列化往返后保留有效的高级精修参数", () => {
    const saved = {
      exposure: 35,
      blur_strength: 48,
      lut_file: "builtin:cinematic",
      lut_intensity: 72,
      curve_rgb: [0.05, 0.2, 0.52, 0.82, 0.98],
      healing_spots: [{ x: 0.2, y: 0.3, radius: 0.04, strength: 0.7 }],
      clone_stamps: [{
        x: 0.6, y: 0.5, sourceX: 0.4, sourceY: 0.45, radius: 0.03, strength: 0.8,
      }],
      liquify_strokes: [{
        x: 0.4, y: 0.5, dx: 0.01, dy: -0.02, radius: 0.08, strength: 0.6, mode: 2,
      }],
      background_cutout_url: "/api/files/cutout.png",
      background_mode: "image",
      background_color: "#12A0EF",
      background_blur: 22,
      background_image_url: "/api/files/background.jpg",
      background_image_scale: 1.4,
      background_image_x: -0.2,
      background_image_y: 0.15,
    };

    const restored = normalizeRetouchSettings(JSON.parse(JSON.stringify(saved)));

    expect(restored).toMatchObject({ ...saved, background_color: "#12a0ef" });
    expect(restored.curve_red).toEqual(IDENTITY_CURVE);
    expect(restored.crop_width).toBe(1);
    expect(restored.background_color).toBe("#12a0ef");
  });

  it("非法曲线回落为单位曲线，有效曲线被夹取到 0 到 1", () => {
    const restored = normalizeRetouchSettings({
      curve_rgb: [0, Number.NaN, 0.5, 0.75, 1],
      curve_red: [0, 0.25, 0.5, 0.75] as never,
      curve_green: [-1, 0.2, 0.5, 0.8, 2],
      curve_blue: "invalid" as never,
    });

    expect(restored.curve_rgb).toEqual(IDENTITY_CURVE);
    expect(restored.curve_red).toEqual(IDENTITY_CURVE);
    expect(restored.curve_green).toEqual([0, 0.2, 0.5, 0.8, 1]);
    expect(restored.curve_blue).toEqual(IDENTITY_CURVE);
  });

  it("过滤局部工具脏数据、限制数量并夹取坐标和强度", () => {
    const healing = Array.from({ length: MAX_HEALING_SPOTS + 2 }, (_, index) => ({
      x: index === MAX_HEALING_SPOTS + 1 ? 2 : 0.5,
      y: -1,
      radius: 1,
      strength: 2,
    }));
    const stamps = Array.from({ length: MAX_CLONE_STAMPS + 1 }, () => ({
      x: 2, y: -1, sourceX: 3, sourceY: -2, radius: 0, strength: -1,
    }));
    const strokes = Array.from({ length: MAX_LIQUIFY_STROKES + 1 }, () => ({
      x: 2, y: -1, dx: 1, dy: -1, radius: 2, strength: 2, mode: 99,
    }));

    const restored = normalizeRetouchSettings({
      healing_spots: [{ x: Number.NaN, y: 0, radius: 0.1, strength: 1 }, ...healing],
      clone_stamps: stamps,
      liquify_strokes: strokes as never,
    });

    expect(restored.healing_spots).toHaveLength(MAX_HEALING_SPOTS);
    expect(restored.healing_spots.at(-1)).toEqual({ x: 1, y: 0, radius: 0.25, strength: 1 });
    expect(restored.clone_stamps).toHaveLength(MAX_CLONE_STAMPS);
    expect(restored.clone_stamps[0]).toEqual({
      x: 1, y: 0, sourceX: 1, sourceY: 0, radius: 0.002, strength: 0,
    });
    expect(restored.liquify_strokes).toHaveLength(MAX_LIQUIFY_STROKES);
    expect(restored.liquify_strokes[0]).toEqual({
      x: 1,
      y: 0,
      dx: LIQUIFY_MAX_SHIFT,
      dy: -LIQUIFY_MAX_SHIFT,
      radius: 0.4,
      strength: 1,
      mode: 0,
    });
  });

  it("人像开关、量程和 LUT 强度在反序列化时得到校正", () => {
    const restored = normalizeRetouchSettings({
      protect_makeup: 0.8,
      blur_strength: 999,
      eye_brighten: Number.NaN,
      lut_file: 123 as never,
      lut_intensity: -20,
    });

    expect(restored.protect_makeup).toBe(1);
    expect(restored.blur_strength).toBe(100);
    expect(restored.eye_brighten).toBe(0);
    expect(restored.lut_file).toBe("");
    expect(restored.lut_intensity).toBe(0);
  });

  it("背景字段拒绝非法模式和脏数据，缺少抠图结果时强制恢复原背景", () => {
    const withoutCutout = normalizeRetouchSettings({
      background_mode: "solid",
      background_color: "red",
      background_blur: 99,
      background_image_scale: 0.1,
      background_image_x: -5,
      background_image_y: 5,
    });
    expect(withoutCutout.background_mode).toBe("original");
    expect(withoutCutout.background_color).toBe("#ffffff");
    expect(withoutCutout.background_blur).toBe(40);
    expect(withoutCutout.background_image_scale).toBe(0.5);
    expect(withoutCutout.background_image_x).toBe(-1);
    expect(withoutCutout.background_image_y).toBe(1);

    const withCutout = normalizeRetouchSettings({
      background_cutout_url: "/api/files/cutout.png",
      background_mode: "unknown" as never,
    });
    expect(withCutout.background_mode).toBe("transparent");
  });

  it("局部蒙版保留独立参数，并限制蒙版和画笔点存档体积", () => {
    const masks = Array.from({ length: MAX_LOCAL_MASKS + 2 }, (_, maskIndex) => ({
      id: maskIndex < 2 ? "duplicate" : `mask-${maskIndex}`,
      name: `蒙版 ${maskIndex}`,
      type: maskIndex === 0 ? "unknown" : "brush",
      enabled: true,
      inverted: maskIndex === 1,
      opacity: 2,
      feather: -1,
      points: Array.from({ length: MAX_LOCAL_MASK_POINTS + 1 }, () => ({
        x: 2, y: -1, radius: 1, opacity: 3, erase: true,
      })),
      luminance_min: 0.9,
      luminance_max: 0.2,
      edge_tolerance: 4,
      adjustments: { exposure: 140, contrast: -140, saturation: 20, temperature: 10, tint: -10 },
    }));

    const restored = normalizeRetouchSettings({ local_masks: masks as never });

    expect(restored.local_masks).toHaveLength(MAX_LOCAL_MASKS);
    expect(new Set(restored.local_masks.map((mask) => mask.id)).size).toBe(MAX_LOCAL_MASKS);
    expect(restored.local_masks[0].points).toHaveLength(MAX_LOCAL_MASK_POINTS);
    expect(restored.local_masks[0].points[0]).toEqual({ x: 1, y: 0, radius: 0.35, opacity: 1, erase: true });
    expect(restored.local_masks[0].opacity).toBe(1);
    expect(restored.local_masks[0].feather).toBe(0.001);
    expect(restored.local_masks[0].luminance_max).toBe(0.9);
    expect(restored.local_masks[0].adjustments.exposure).toBe(100);
    expect(restored.local_masks[0].adjustments.contrast).toBe(-100);
  });
});
