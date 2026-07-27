/**
 * 3D LUT 解析与纹理化。
 *
 * WebGL1 没有 3D 纹理，立方体按「横向条带」展开成 (size*size) x size 的 2D 纹理：
 * 第 b 个切片占据 x ∈ [b*size, (b+1)*size)，片内 x 对应红、y 对应绿。
 * 采样逻辑见 `glsl/common.ts` 的 `sampleLut`。
 */

/** 条带化后的 LUT，可直接 texImage2D 上传 */
export interface LutData {
  /** 立方体边长（条带纹理宽 = size*size，高 = size） */
  size: number;
  /** RGBA8 像素，长度 size*size*size*4 */
  pixels: Uint8Array;
}

/** 超过该边长的 LUT 会被重采样，避免纹理宽度超出设备上限 */
const MAX_LUT_SIZE = 33;
const RESAMPLE_SIZE = 32;

export class LutParseError extends Error {}

interface RawCube {
  size: number;
  /** 长度 size^3 * 3 的浮点数据，红色变化最快 */
  values: Float32Array;
}

/** 解析 Adobe .cube 文本 */
function parseCubeText(text: string): RawCube {
  let size = 0;
  let domainMin = [0, 0, 0];
  let domainMax = [1, 1, 1];
  const values: number[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const upper = line.toUpperCase();
    if (upper.startsWith("TITLE")) continue;
    if (upper.startsWith("LUT_1D_SIZE")) {
      throw new LutParseError("暂不支持一维 LUT（LUT_1D_SIZE），请使用 3D LUT");
    }
    if (upper.startsWith("LUT_3D_SIZE")) {
      size = Number.parseInt(line.split(/\s+/)[1] ?? "", 10);
      continue;
    }
    if (upper.startsWith("DOMAIN_MIN")) {
      domainMin = line.split(/\s+/).slice(1, 4).map(Number);
      continue;
    }
    if (upper.startsWith("DOMAIN_MAX")) {
      domainMax = line.split(/\s+/).slice(1, 4).map(Number);
      continue;
    }

    const parts = line.split(/\s+/);
    if (parts.length < 3) continue;
    const r = Number.parseFloat(parts[0]);
    const g = Number.parseFloat(parts[1]);
    const b = Number.parseFloat(parts[2]);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) continue;
    values.push(r, g, b);
  }

  if (!Number.isFinite(size) || size < 2) {
    throw new LutParseError("未找到有效的 LUT_3D_SIZE 声明");
  }
  const expected = size * size * size * 3;
  if (values.length < expected) {
    throw new LutParseError(`LUT 数据不完整：期望 ${expected / 3} 个采样点，实际 ${Math.floor(values.length / 3)} 个`);
  }

  // 把定义域归一化回 0~1，兼容 DOMAIN_MIN/MAX 非默认的 LUT
  const out = new Float32Array(expected);
  for (let i = 0; i < expected; i += 3) {
    for (let c = 0; c < 3; c++) {
      const span = domainMax[c] - domainMin[c];
      const normalized = span > 0.000001 ? (values[i + c] - domainMin[c]) / span : values[i + c];
      out[i + c] = Math.min(1, Math.max(0, normalized));
    }
  }
  return { size, values: out };
}

function sampleCube(cube: RawCube, r: number, g: number, b: number): [number, number, number] {
  const index = (r + g * cube.size + b * cube.size * cube.size) * 3;
  return [cube.values[index], cube.values[index + 1], cube.values[index + 2]];
}

/** 三线性重采样到目标边长，用于压缩过大的 LUT */
function resampleCube(cube: RawCube, target: number): RawCube {
  const values = new Float32Array(target * target * target * 3);
  const scale = (cube.size - 1) / (target - 1);
  for (let b = 0; b < target; b++) {
    for (let g = 0; g < target; g++) {
      for (let r = 0; r < target; r++) {
        const fr = r * scale;
        const fg = g * scale;
        const fb = b * scale;
        const r0 = Math.floor(fr); const r1 = Math.min(r0 + 1, cube.size - 1); const tr = fr - r0;
        const g0 = Math.floor(fg); const g1 = Math.min(g0 + 1, cube.size - 1); const tg = fg - g0;
        const b0 = Math.floor(fb); const b1 = Math.min(b0 + 1, cube.size - 1); const tb = fb - b0;
        const out = (r + g * target + b * target * target) * 3;
        for (let c = 0; c < 3; c++) {
          const c000 = sampleCube(cube, r0, g0, b0)[c];
          const c100 = sampleCube(cube, r1, g0, b0)[c];
          const c010 = sampleCube(cube, r0, g1, b0)[c];
          const c110 = sampleCube(cube, r1, g1, b0)[c];
          const c001 = sampleCube(cube, r0, g0, b1)[c];
          const c101 = sampleCube(cube, r1, g0, b1)[c];
          const c011 = sampleCube(cube, r0, g1, b1)[c];
          const c111 = sampleCube(cube, r1, g1, b1)[c];
          const c00 = c000 + (c100 - c000) * tr;
          const c10 = c010 + (c110 - c010) * tr;
          const c01 = c001 + (c101 - c001) * tr;
          const c11 = c011 + (c111 - c011) * tr;
          const c0 = c00 + (c10 - c00) * tg;
          const c1 = c01 + (c11 - c01) * tg;
          values[out + c] = c0 + (c1 - c0) * tb;
        }
      }
    }
  }
  return { size: target, values };
}

/** 立方体展开成横向条带的 RGBA8 像素 */
function cubeToStrip(cube: RawCube): LutData {
  const { size } = cube;
  const width = size * size;
  const pixels = new Uint8Array(width * size * 4);
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const src = (r + g * size + b * size * size) * 3;
        const x = b * size + r;
        const dst = (g * width + x) * 4;
        pixels[dst] = Math.round(cube.values[src] * 255);
        pixels[dst + 1] = Math.round(cube.values[src + 1] * 255);
        pixels[dst + 2] = Math.round(cube.values[src + 2] * 255);
        pixels[dst + 3] = 255;
      }
    }
  }
  return { size, pixels };
}

/** 解析 .cube 文本并转成可直接上传的条带纹理 */
export function parseCubeLut(text: string): LutData {
  let cube = parseCubeText(text);
  if (cube.size > MAX_LUT_SIZE) {
    cube = resampleCube(cube, RESAMPLE_SIZE);
  }
  return cubeToStrip(cube);
}

/** 序列化为 base64，便于存入 localStorage 与随预设同步 */
export function encodeLutData(lut: LutData): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < lut.pixels.length; i += chunk) {
    binary += String.fromCharCode(...lut.pixels.subarray(i, i + chunk));
  }
  return `${lut.size}:${btoa(binary)}`;
}

export function decodeLutData(encoded: string): LutData | null {
  const separator = encoded.indexOf(":");
  if (separator <= 0) return null;
  const size = Number.parseInt(encoded.slice(0, separator), 10);
  if (!Number.isFinite(size) || size < 2) return null;
  try {
    const binary = atob(encoded.slice(separator + 1));
    const pixels = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) pixels[i] = binary.charCodeAt(i);
    if (pixels.length !== size * size * size * 4) return null;
    return { size, pixels };
  } catch {
    return null;
  }
}
