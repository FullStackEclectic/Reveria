import type { LutData } from "./lut";

/**
 * 内置 LUT。
 *
 * 这些 LUT 由真实的色彩变换公式在运行时生成，而不是引用随包分发的 .cube 文件，
 * 因此既不会出现「按钮存在但文件缺失」的空引用，也便于按需调整风格。
 */

const BUILTIN_LUT_SIZE = 32;

type Rgb = [number, number, number];
type Transform = (color: Rgb) => Rgb;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function luma([r, g, b]: Rgb): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** 调整饱和度，1 为不变 */
function saturate(color: Rgb, amount: number): Rgb {
  const l = luma(color);
  return color.map((c) => clamp01(l + (c - l) * amount)) as Rgb;
}

/** 电影调色常用的 lift / gamma / gain：分别控制暗部、中间调、亮部 */
function liftGammaGain(color: Rgb, lift: Rgb, gamma: Rgb, gain: Rgb): Rgb {
  return color.map((c, i) => {
    const lifted = lift[i] + c * (1 - lift[i]);
    const gained = lifted * gain[i];
    return clamp01(Math.pow(Math.max(gained, 0), 1 / gamma[i]));
  }) as Rgb;
}

/** 以中点为轴的对比调整 */
function contrast(color: Rgb, amount: number): Rgb {
  return color.map((c) => clamp01((c - 0.5) * amount + 0.5)) as Rgb;
}

/** 褪色：抬高黑位，模拟胶片的低对比暗部 */
function fadeBlacks(color: Rgb, amount: number): Rgb {
  return color.map((c) => clamp01(amount + c * (1 - amount))) as Rgb;
}

/** 分离色调：给暗部与亮部分别染色 */
function splitTone(color: Rgb, shadowTint: Rgb, highlightTint: Rgb, strength: number): Rgb {
  const l = luma(color);
  const shadowWeight = (1 - l) * strength;
  const highlightWeight = l * strength;
  return color.map((c, i) =>
    clamp01(c + (shadowTint[i] - 0.5) * shadowWeight + (highlightTint[i] - 0.5) * highlightWeight),
  ) as Rgb;
}

const TRANSFORMS: Record<string, Transform> = {
  // 中性高级灰：降饱和 + 轻微褪黑 + 中间调提对比
  "builtin-neutral-gray": (color) => {
    let c = saturate(color, 0.72);
    c = fadeBlacks(c, 0.04);
    c = contrast(c, 1.08);
    return splitTone(c, [0.49, 0.50, 0.52], [0.51, 0.50, 0.49], 0.06);
  },
  // 日系清透：整体提亮、低对比、暗部偏青
  "builtin-japanese": (color) => {
    let c = liftGammaGain(color, [0.05, 0.055, 0.06], [1.06, 1.05, 1.02], [1.02, 1.02, 1.03]);
    c = saturate(c, 0.88);
    c = contrast(c, 0.93);
    return splitTone(c, [0.47, 0.51, 0.53], [0.52, 0.51, 0.49], 0.10);
  },
  // 复古胶片：暗部偏绿、亮部偏暖、黑位抬高
  "builtin-film": (color) => {
    let c = fadeBlacks(color, 0.07);
    c = saturate(c, 0.85);
    c = liftGammaGain(c, [0.02, 0.03, 0.02], [1.0, 1.02, 0.98], [1.03, 1.0, 0.95]);
    return splitTone(c, [0.47, 0.52, 0.48], [0.55, 0.51, 0.45], 0.16);
  },
  // 温暖秋色：强化红橙、压制蓝青
  "builtin-autumn": (color) => {
    const [r, g, b] = color;
    let c: Rgb = [clamp01(r * 1.08 + 0.02), clamp01(g * 1.0), clamp01(b * 0.88)];
    c = saturate(c, 1.12);
    c = contrast(c, 1.05);
    return splitTone(c, [0.52, 0.49, 0.46], [0.55, 0.52, 0.45], 0.12);
  },
  // 黑白胶片：带红色滤镜响应的单色转换，肤色更通透
  "builtin-mono": (color) => {
    const [r, g, b] = color;
    const value = clamp01(0.40 * r + 0.45 * g + 0.15 * b);
    const toned = clamp01((value - 0.5) * 1.12 + 0.5);
    return [toned, toned, toned];
  },
};

export interface BuiltinLutMeta {
  id: string;
  name: string;
}

export const BUILTIN_LUTS: BuiltinLutMeta[] = [
  { id: "builtin-neutral-gray", name: "中性高级灰" },
  { id: "builtin-japanese", name: "日系清透" },
  { id: "builtin-film", name: "复古胶片" },
  { id: "builtin-autumn", name: "温暖秋色" },
  { id: "builtin-mono", name: "黑白胶片" },
];

/** 按内置 LUT 的变换公式生成条带纹理数据 */
export function generateBuiltinLut(id: string): LutData | null {
  const transform = TRANSFORMS[id];
  if (!transform) return null;

  const size = BUILTIN_LUT_SIZE;
  const width = size * size;
  const pixels = new Uint8Array(width * size * 4);
  const denominator = size - 1;

  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const mapped = transform([r / denominator, g / denominator, b / denominator]);
        const x = b * size + r;
        const dst = (g * width + x) * 4;
        pixels[dst] = Math.round(clamp01(mapped[0]) * 255);
        pixels[dst + 1] = Math.round(clamp01(mapped[1]) * 255);
        pixels[dst + 2] = Math.round(clamp01(mapped[2]) * 255);
        pixels[dst + 3] = 255;
      }
    }
  }
  return { size, pixels };
}
