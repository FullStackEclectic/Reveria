import type { CurvePoints, RetouchSettings } from "./settings";

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function fract(x: number): number {
  return x - Math.floor(x);
}

function luma(r: number, g: number, b: number): number {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

function adjustSat(r: number, g: number, b: number, factor: number): [number, number, number] {
  const l = luma(r, g, b);
  return [lerp(l, r, factor), lerp(l, g, factor), lerp(l, b, factor)];
}

function applyCurve(x: number, points: CurvePoints): number {
  const scaled = clamp(x, 0, 1) * 4.0;
  if (scaled < 1.0) return lerp(points[0], points[1], scaled);
  if (scaled < 2.0) return lerp(points[1], points[2], scaled - 1.0);
  if (scaled < 3.0) return lerp(points[2], points[3], scaled - 2.0);
  return lerp(points[3], points[4], scaled - 3.0);
}

function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
}

function applyHslChannel(
  hsl: [number, number, number],
  center: number, halfW: number,
  dH: number, dS: number, dL: number,
): [number, number, number] {
  let d = Math.abs(hsl[0] - center);
  if (d > 0.5) d = 1.0 - d;
  const w = (1.0 - smoothstep(0.0, halfW, d)) * smoothstep(0.05, 0.15, hsl[1]);
  if (w > 0.001) {
    hsl[0] += dH * 0.005 * w;
    hsl[1] = clamp(hsl[1] * (1.0 + dS * 0.01 * w), 0.0, 1.0);
    hsl[2] = clamp(hsl[2] + dL * 0.003 * w, 0.0, 1.0);
  }
  return hsl;
}

const HSL_CHANNELS: Array<{
  center: number; halfW: number;
  h: keyof RetouchSettings; s: keyof RetouchSettings; l: keyof RetouchSettings;
}> = [
  { center: 0.0,   halfW: 0.05,  h: "hsl_red_h",     s: "hsl_red_s",     l: "hsl_red_l" },
  { center: 0.069, halfW: 0.027, h: "hsl_orange_h",  s: "hsl_orange_s",  l: "hsl_orange_l" },
  { center: 0.132, halfW: 0.035, h: "hsl_yellow_h",  s: "hsl_yellow_s",  l: "hsl_yellow_l" },
  { center: 0.271, halfW: 0.1,   h: "hsl_green_h",   s: "hsl_green_s",   l: "hsl_green_l" },
  { center: 0.438, halfW: 0.062, h: "hsl_aqua_h",    s: "hsl_aqua_s",    l: "hsl_aqua_l" },
  { center: 0.583, halfW: 0.083, h: "hsl_blue_h",    s: "hsl_blue_s",    l: "hsl_blue_l" },
  { center: 0.729, halfW: 0.062, h: "hsl_purple_h",  s: "hsl_purple_s",  l: "hsl_purple_l" },
  { center: 0.875, halfW: 0.083, h: "hsl_magenta_h", s: "hsl_magenta_s", l: "hsl_magenta_l" },
];

function applyPipeline(r: number, g: number, b: number, s: RetouchSettings): [number, number, number] {
  const L = luma(r, g, b);

  const expFactor = 1.0 + s.exposure * 0.01;
  r *= expFactor; g *= expFactor; b *= expFactor;

  const hMask = smoothstep(0.5, 1.0, L);
  const sMask = 1.0 - smoothstep(0.0, 0.5, L);
  const wMask = smoothstep(0.8, 1.0, L);
  const bMask = 1.0 - smoothstep(0.0, 0.2, L);
  const hlAdj = s.highlights * 0.003 * hMask;
  const shAdj = s.shadows * 0.003 * sMask;
  const whAdj = s.whites * 0.002 * wMask;
  const blAdj = s.blacks * 0.002 * bMask;
  r += hlAdj + shAdj + whAdj + blAdj;
  g += hlAdj + shAdj + whAdj + blAdj;
  b += hlAdj + shAdj + whAdj + blAdj;

  const cf = 1.0 + s.contrast * 0.01;
  r = (r - 0.5) * cf + 0.5;
  g = (g - 0.5) * cf + 0.5;
  b = (b - 0.5) * cf + 0.5;

  r += s.temperature * 0.0008;
  b -= s.temperature * 0.0008;

  g += s.tint * 0.0004;
  r -= s.tint * 0.0002;
  b -= s.tint * 0.0002;

  [r, g, b] = adjustSat(r, g, b, 1.0 + s.saturation * 0.01);

  const lumV = luma(r, g, b);
  const dr = r - lumV, dg = g - lumV, db = b - lumV;
  const vibranceSat = Math.sqrt(dr * dr + dg * dg + db * db);
  [r, g, b] = adjustSat(r, g, b, 1.0 + s.vibrance * 0.01 * (1.0 - vibranceSat * 1.5));

  if (s.dehaze !== 0) {
    const df = 1.0 + s.dehaze * 0.005;
    r = (r - 0.5) * df + 0.5;
    g = (g - 0.5) * df + 0.5;
    b = (b - 0.5) * df + 0.5;
    [r, g, b] = adjustSat(r, g, b, 1.0 + s.dehaze * 0.003);
  }

  let hsl = rgb2hsl(r, g, b);
  for (const ch of HSL_CHANNELS) {
    hsl = applyHslChannel(hsl, ch.center, ch.halfW,
      s[ch.h] as number, s[ch.s] as number, s[ch.l] as number);
  }
  hsl[0] = fract(hsl[0]);
  [r, g, b] = hsl2rgb(hsl[0], hsl[1], hsl[2]);

  const toneMidpoint = 0.5 - s.tone_balance * 0.0025;
  const toneLuma = luma(r, g, b);
  const shadowToneMask = 1.0 - smoothstep(toneMidpoint - 0.25, toneMidpoint + 0.15, toneLuma);
  const highlightToneMask = smoothstep(toneMidpoint - 0.15, toneMidpoint + 0.25, toneLuma);
  const [stR, stG, stB] = hsl2rgb(fract(s.shadow_tone_hue / 360.0), 1.0, 0.5);
  const [htR, htG, htB] = hsl2rgb(fract(s.highlight_tone_hue / 360.0), 1.0, 0.5);
  const stL = luma(stR, stG, stB);
  const htL = luma(htR, htG, htB);
  const shadowScale = s.shadow_tone_saturation * 0.0035 * shadowToneMask;
  const highlightScale = s.highlight_tone_saturation * 0.0035 * highlightToneMask;
  r += (stR - stL) * shadowScale + (htR - htL) * highlightScale;
  g += (stG - stL) * shadowScale + (htG - htL) * highlightScale;
  b += (stB - stL) * shadowScale + (htB - htL) * highlightScale;

  r = applyCurve(r, s.curve_rgb);
  g = applyCurve(g, s.curve_rgb);
  b = applyCurve(b, s.curve_rgb);

  r = applyCurve(r, s.curve_red);
  g = applyCurve(g, s.curve_green);
  b = applyCurve(b, s.curve_blue);

  return [clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1)];
}

export function exportSettingsAsCube(settings: RetouchSettings, size: number = 33): string {
  const lines: string[] = [
    'TITLE "Reveria LUT"',
    `LUT_3D_SIZE ${size}`,
    "DOMAIN_MIN 0.0 0.0 0.0",
    "DOMAIN_MAX 1.0 1.0 1.0",
    "",
  ];

  for (let bi = 0; bi < size; bi++) {
    for (let gi = 0; gi < size; gi++) {
      for (let ri = 0; ri < size; ri++) {
        const [ro, go, bo] = applyPipeline(
          ri / (size - 1),
          gi / (size - 1),
          bi / (size - 1),
          settings,
        );
        lines.push(`${ro.toFixed(6)} ${go.toFixed(6)} ${bo.toFixed(6)}`);
      }
    }
  }

  return lines.join("\n") + "\n";
}

export function downloadSettingsAsCube(settings: RetouchSettings, filename: string) {
  const blob = new Blob([exportSettingsAsCube(settings)], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
