import { describe, expect, it } from "vitest";
import { calculateHistogram, HISTOGRAM_BIN_COUNT, suggestBorderColor } from "./histogram";

describe("calculateHistogram", () => {
  it("按 RGB 与感知亮度统计成片像素，并忽略全透明像素", () => {
    const histogram = calculateHistogram(new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
      255, 255, 255, 0,
    ]));

    expect(histogram.red).toHaveLength(HISTOGRAM_BIN_COUNT);
    expect(histogram.red[63]).toBe(0.5);
    expect(histogram.green[63]).toBe(0.5);
    expect(histogram.blue[63]).toBe(0.5);
    expect(histogram.luminance.some((value) => value > 0)).toBe(true);
  });

  it("根据直方图估算边框色，亮图压暗并保留色相", () => {
    const bright = calculateHistogram(new Uint8ClampedArray([
      240, 210, 180, 255,
      250, 220, 190, 255,
      230, 200, 170, 255,
    ]));
    const color = suggestBorderColor(bright);
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
    const red = parseInt(color.slice(1, 3), 16);
    const green = parseInt(color.slice(3, 5), 16);
    const blue = parseInt(color.slice(5, 7), 16);
    expect(red).toBeGreaterThan(green);
    expect(green).toBeGreaterThan(blue);
    expect(red).toBeLessThan(200);
  });
});
