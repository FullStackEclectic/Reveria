import { describe, expect, it } from "vitest";
import {
  IDENTITY_FREE_TRANSFORM,
  isFreeTransformActive,
  mapFreeTransformUv,
  normalizeFreeTransformPoints,
} from "./freeTransform";

describe("freeTransform", () => {
  it("单位网格判定为未启用，拖动角点后启用", () => {
    expect(isFreeTransformActive(IDENTITY_FREE_TRANSFORM)).toBe(false);
    expect(isFreeTransformActive([
      [0.12, 0.08], [1, 0], [1, 1], [0, 1], [0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5],
    ])).toBe(true);
  });

  it("单位变形把输出 UV 映射回自身", () => {
    const samples: Array<[number, number]> = [
      [0, 0], [1, 0], [1, 1], [0, 1], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.5, 0.5],
    ];
    for (const uv of samples) {
      const mapped = mapFreeTransformUv(uv, IDENTITY_FREE_TRANSFORM);
      expect(mapped).not.toBeNull();
      expect(mapped![0]).toBeCloseTo(uv[0], 3);
      expect(mapped![1]).toBeCloseTo(uv[1], 3);
    }
  });

  it("把左上角拖入画面后，该点采样到源图原点", () => {
    const points = normalizeFreeTransformPoints([
      [0.2, 0.2], [1, 0], [1, 1], [0, 1], [0.6, 0.1], [1, 0.5], [0.5, 1], [0.1, 0.6],
    ]);
    const mapped = mapFreeTransformUv([0.2, 0.2], points);
    expect(mapped).not.toBeNull();
    expect(mapped![0]).toBeCloseTo(0, 2);
    expect(mapped![1]).toBeCloseTo(0, 2);
    expect(mapFreeTransformUv([0.02, 0.02], points)).toBeNull();
  });
});
