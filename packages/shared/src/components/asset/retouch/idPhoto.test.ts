import { describe, expect, it } from "vitest";
import { fitIdPhotoCrop, ID_PHOTO_SPECS } from "./idPhoto";

describe("fitIdPhotoCrop", () => {
  it("横向原图居中裁出竖向证件照比例", () => {
    const spec = ID_PHOTO_SPECS[0];
    const crop = fitIdPhotoCrop(1600, 900, spec);
    expect(crop.crop_height).toBe(1);
    expect(crop.crop_width).toBeCloseTo((spec.widthPx / spec.heightPx) / (1600 / 900), 5);
    expect(crop.crop_x + crop.crop_width).toBeCloseTo(1 - crop.crop_x, 5);
  });

  it("竖向原图上下留边以匹配证件照比例", () => {
    const spec = ID_PHOTO_SPECS[0];
    const crop = fitIdPhotoCrop(900, 1600, spec);
    expect(crop.crop_width).toBe(1);
    expect(crop.crop_height).toBeLessThan(1);
    expect(crop.crop_y).toBeGreaterThan(0);
  });
});
