import { describe, expect, it } from "vitest";
import { bakeLocalMaskAtlas, createLocalMask, packLocalMasks } from "./localMasks";

describe("localMasks", () => {
  it("将画笔和擦除点按顺序烘焙到蒙版图集", () => {
    const mask = createLocalMask("brush", 1);
    mask.edge_aware = false;
    mask.points = [{ x: 0.5, y: 0.5, radius: 0.2, opacity: 1, erase: false }];
    const painted = bakeLocalMaskAtlas([mask], 1);
    const center = (64 * 384 + 64) * 4;
    expect(painted[center]).toBeGreaterThan(240);

    mask.points.push({ x: 0.5, y: 0.5, radius: 0.1, opacity: 1, erase: true });
    const erased = bakeLocalMaskAtlas([mask], 1);
    expect(erased[center]).toBeLessThan(10);
  });

  it("按固定槽位打包每个蒙版的独立参数", () => {
    const mask = createLocalMask("color", 1);
    mask.opacity = 0.7;
    mask.color_hue = 180;
    mask.adjustments.exposure = 25;
    const packed = packLocalMasks([mask], false);

    expect(Array.from(packed.meta.slice(0, 2))).toEqual([4, 1]);
    expect(packed.meta[2]).toBeCloseTo(0.7);
    expect(packed.meta[3]).toBe(0);
    expect(packed.range[0]).toBeCloseTo(0.5);
    expect(packed.adjustmentA[0]).toBe(25);
  });
});
