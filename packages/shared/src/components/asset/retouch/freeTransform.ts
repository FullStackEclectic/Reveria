/** 自由变形 8 控制点：0=左上 1=右上 2=右下 3=左下 4=上中 5=右中 6=下中 7=左中 */
export type FreeTransformPoints = [
  [number, number], [number, number], [number, number], [number, number],
  [number, number], [number, number], [number, number], [number, number],
];

export const IDENTITY_FREE_TRANSFORM: FreeTransformPoints = [
  [0, 0], [1, 0], [1, 1], [0, 1],
  [0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5],
];

const POINT_MIN = -0.5;
const POINT_MAX = 1.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function isFreeTransformActive(points: [number, number][] | undefined): boolean {
  if (!points || points.length !== 8) return false;
  return points.some((point, index) => (
    Math.abs(point[0] - IDENTITY_FREE_TRANSFORM[index][0]) > 0.0001
    || Math.abs(point[1] - IDENTITY_FREE_TRANSFORM[index][1]) > 0.0001
  ));
}

export function normalizeFreeTransformPoints(value: unknown): FreeTransformPoints {
  if (!Array.isArray(value) || value.length !== 8) {
    return IDENTITY_FREE_TRANSFORM.map((point) => [...point]) as FreeTransformPoints;
  }
  const result: [number, number][] = [];
  for (const point of value) {
    if (!Array.isArray(point) || point.length < 2 || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
      return IDENTITY_FREE_TRANSFORM.map((item) => [...item]) as FreeTransformPoints;
    }
    result.push([clamp(point[0], POINT_MIN, POINT_MAX), clamp(point[1], POINT_MIN, POINT_MAX)]);
  }
  return result as FreeTransformPoints;
}

function cross2(a: [number, number], b: [number, number]): number {
  return a[0] * b[1] - a[1] * b[0];
}

function sub(a: [number, number], b: [number, number]): [number, number] {
  return [a[0] - b[0], a[1] - b[1]];
}

function invBilinear(
  p: [number, number],
  a: [number, number],
  b: [number, number],
  c: [number, number],
  d: [number, number],
): [number, number] | null {
  const e = sub(b, a);
  const f = sub(d, a);
  const g: [number, number] = [a[0] - b[0] + c[0] - d[0], a[1] - b[1] + c[1] - d[1]];
  const h = sub(p, a);
  const k2 = cross2(g, f);
  const k1 = cross2(e, f) + cross2(h, g);
  const k0 = cross2(h, e);

  const solveU = (v: number): number => {
    const denom: [number, number] = [e[0] + g[0] * v, e[1] + g[1] * v];
    if (Math.abs(denom[0]) > Math.abs(denom[1])) {
      return Math.abs(denom[0]) < 0.0001 ? Number.NaN : (h[0] - f[0] * v) / denom[0];
    }
    return Math.abs(denom[1]) < 0.0001 ? Number.NaN : (h[1] - f[1] * v) / denom[1];
  };

  const inside = (u: number, v: number) => (
    Number.isFinite(u) && Number.isFinite(v) && u >= -0.002 && u <= 1.002 && v >= -0.002 && v <= 1.002
  );

  let u = -1;
  let v = -1;
  if (Math.abs(k2) < 0.0001) {
    if (Math.abs(k1) < 0.0001) return null;
    v = -k0 / k1;
    u = solveU(v);
  } else {
    const disc = k1 * k1 - 4 * k2 * k0;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const v1 = (-k1 - root) / (2 * k2);
    const v2 = (-k1 + root) / (2 * k2);
    const u1 = solveU(v1);
    const u2 = solveU(v2);
    if (inside(u1, v1)) { u = u1; v = v1; }
    else if (inside(u2, v2)) { u = u2; v = v2; }
    else return null;
  }
  if (!inside(u, v)) return null;
  return [clamp(u, 0, 1), clamp(v, 0, 1)];
}

/**
 * 把输出画布 UV 逆映射回源图 UV。点在四边形外时返回 null。
 * 与 shader 中 `applyFreeTransform` 使用同一套 4 格双线性求逆。
 */
export function mapFreeTransformUv(
  outputUv: [number, number],
  points: [number, number][],
): [number, number] | null {
  if (points.length !== 8) return outputUv;
  const [tl, tr, br, bl, mt, mr, mb, ml] = points;
  const center: [number, number] = [
    (mt[0] + mr[0] + mb[0] + ml[0]) * 0.25,
    (mt[1] + mr[1] + mb[1] + ml[1]) * 0.25,
  ];
  const topLeft = invBilinear(outputUv, tl, mt, center, ml);
  if (topLeft) return [topLeft[0] * 0.5, topLeft[1] * 0.5];
  const topRight = invBilinear(outputUv, mt, tr, mr, center);
  if (topRight) return [0.5 + topRight[0] * 0.5, topRight[1] * 0.5];
  const bottomLeft = invBilinear(outputUv, ml, center, mb, bl);
  if (bottomLeft) return [bottomLeft[0] * 0.5, 0.5 + bottomLeft[1] * 0.5];
  const bottomRight = invBilinear(outputUv, center, mr, br, mb);
  if (bottomRight) return [0.5 + bottomRight[0] * 0.5, 0.5 + bottomRight[1] * 0.5];
  return null;
}
