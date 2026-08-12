import { describe, expect, it } from "vitest";
import { calculateHistogram, HISTOGRAM_BIN_COUNT } from "./histogram";

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
});
