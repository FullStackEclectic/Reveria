import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./settings";
import { exportSettingsAsCube } from "./exportLut";

function parseCubeSamples(text: string): number[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^(#|TITLE|LUT_|DOMAIN_)/i.test(line))
    .map((line) => line.split(/\s+/).map(Number));
}

describe("exportSettingsAsCube", () => {
  it("写出可被解析的 3D LUT 头与采样点", () => {
    const cube = exportSettingsAsCube(DEFAULT_SETTINGS, 2);
    expect(cube).toContain("LUT_3D_SIZE 2");
    expect(cube).toContain("DOMAIN_MIN 0.0 0.0 0.0");
    const samples = parseCubeSamples(cube);
    expect(samples).toHaveLength(8);
    expect(samples[0]?.every((value) => Math.abs(value) < 0.02)).toBe(true);
    expect(samples.at(-1)?.every((value) => Math.abs(value - 1) < 0.02)).toBe(true);
  });

  it("曝光变化会写入 LUT 采样，而不是单位映射", () => {
    const identity = parseCubeSamples(exportSettingsAsCube(DEFAULT_SETTINGS, 3));
    const exposed = parseCubeSamples(exportSettingsAsCube({ ...DEFAULT_SETTINGS, exposure: 80 }, 3));
    expect(exposed[1]?.[0]).toBeGreaterThan(identity[1]?.[0] ?? 0);
  });
});
