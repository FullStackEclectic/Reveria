export type CurvePoints = [number, number, number, number, number];
export type CurveKey = "curve_rgb" | "curve_red" | "curve_green" | "curve_blue";
export interface HealingSpot { x: number; y: number; radius: number; strength: number }
export interface CloneStamp { x: number; y: number; sourceX: number; sourceY: number; radius: number; strength: number }

export const IDENTITY_CURVE: CurvePoints = [0, 0.25, 0.5, 0.75, 1];
export const MAX_HEALING_SPOTS = 16;
export const MAX_CLONE_STAMPS = 12;

export interface RetouchSettings {
  // 光影
  exposure: number;      // -100 ~ 100
  contrast: number;      // -100 ~ 100
  highlights: number;    // -100 ~ 100
  shadows: number;       // -100 ~ 100
  whites: number;        // -100 ~ 100
  blacks: number;        // -100 ~ 100
  // 色彩
  saturation: number;    // -100 ~ 100
  vibrance: number;      // -100 ~ 100
  temperature: number;   // -100 ~ 100 (负=冷蓝, 正=暖橙)
  tint: number;          // -100 ~ 100 (负=品红, 正=绿)
  dehaze: number;        // 0 ~ 100
  // 细节
  clarity: number;       // -100 ~ 100
  sharpness: number;     // 0 ~ 100
  // 人像基础 (Shader 直接实现，无需 Face Mesh)
  blur_strength: number; // 0 ~ 100 磨皮
  skin_whiten: number;   // 0 ~ 100 美白
  // 人像形态 (预留字段，需 Face Mesh，当前 Shader 不处理)
  eye_enlarge: number;   // 0 ~ 100
  eye_brighten: number;  // 0 ~ 100 眼白提亮
  slim_face: number;     // 0 ~ 100
  // 几何（裁剪坐标基于旋转后的显示图像，范围 0 ~ 1）
  rotation: number;      // 0/1/2/3，对应顺时针 0/90/180/270 度
  flip_horizontal: number;
  flip_vertical: number;
  crop_x: number;
  crop_y: number;
  crop_width: number;
  crop_height: number;
  // 创意
  lut_file: string;
  // HSL 分色调整 (8通道 × hue/saturation/luminance)
  hsl_red_h: number;     hsl_red_s: number;     hsl_red_l: number;
  hsl_orange_h: number;  hsl_orange_s: number;  hsl_orange_l: number;
  hsl_yellow_h: number;  hsl_yellow_s: number;  hsl_yellow_l: number;
  hsl_green_h: number;   hsl_green_s: number;   hsl_green_l: number;
  hsl_aqua_h: number;    hsl_aqua_s: number;    hsl_aqua_l: number;
  hsl_blue_h: number;    hsl_blue_s: number;    hsl_blue_l: number;
  hsl_purple_h: number;  hsl_purple_s: number;  hsl_purple_l: number;
  hsl_magenta_h: number; hsl_magenta_s: number; hsl_magenta_l: number;
  // RGB 曲线（固定输入点 0 / 25 / 50 / 75 / 100%，数组保存输出值）
  curve_rgb: CurvePoints;
  curve_red: CurvePoints;
  curve_green: CurvePoints;
  curve_blue: CurvePoints;
  // 色调映射
  shadow_tone_hue: number;       // 0 ~ 360
  shadow_tone_saturation: number; // 0 ~ 100
  highlight_tone_hue: number;    // 0 ~ 360
  highlight_tone_saturation: number; // 0 ~ 100
  tone_balance: number;          // -100 ~ 100
  healing_spots: HealingSpot[];
  clone_stamps: CloneStamp[];
}

export const DEFAULT_SETTINGS: RetouchSettings = {
  exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
  saturation: 0, vibrance: 0, temperature: 0, tint: 0, dehaze: 0,
  clarity: 0, sharpness: 0,
  blur_strength: 0, skin_whiten: 0,
  eye_enlarge: 0, eye_brighten: 0, slim_face: 0,
  rotation: 0, flip_horizontal: 0, flip_vertical: 0,
  crop_x: 0, crop_y: 0, crop_width: 1, crop_height: 1,
  lut_file: "",
  hsl_red_h: 0,     hsl_red_s: 0,     hsl_red_l: 0,
  hsl_orange_h: 0,  hsl_orange_s: 0,  hsl_orange_l: 0,
  hsl_yellow_h: 0,  hsl_yellow_s: 0,  hsl_yellow_l: 0,
  hsl_green_h: 0,   hsl_green_s: 0,   hsl_green_l: 0,
  hsl_aqua_h: 0,    hsl_aqua_s: 0,    hsl_aqua_l: 0,
  hsl_blue_h: 0,    hsl_blue_s: 0,    hsl_blue_l: 0,
  hsl_purple_h: 0,  hsl_purple_s: 0,  hsl_purple_l: 0,
  hsl_magenta_h: 0, hsl_magenta_s: 0, hsl_magenta_l: 0,
  curve_rgb: [...IDENTITY_CURVE],
  curve_red: [...IDENTITY_CURVE],
  curve_green: [...IDENTITY_CURVE],
  curve_blue: [...IDENTITY_CURVE],
  shadow_tone_hue: 220, shadow_tone_saturation: 0,
  highlight_tone_hue: 40, highlight_tone_saturation: 0,
  tone_balance: 0,
  healing_spots: [],
  clone_stamps: [],
};

function normalizeCurve(value: unknown): CurvePoints {
  if (!Array.isArray(value) || value.length !== 5) return [...IDENTITY_CURVE];
  if (!value.every((point) => typeof point === "number" && Number.isFinite(point))) {
    return [...IDENTITY_CURVE];
  }
  return value.map((point) => Math.min(1, Math.max(0, point))) as CurvePoints;
}

function normalizeHealingSpots(value: unknown): HealingSpot[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((spot): spot is HealingSpot => spot != null && typeof spot === "object"
      && [spot.x, spot.y, spot.radius, spot.strength].every((item) => typeof item === "number" && Number.isFinite(item)))
    .slice(-MAX_HEALING_SPOTS)
    .map((spot) => ({
      x: Math.min(1, Math.max(0, spot.x)),
      y: Math.min(1, Math.max(0, spot.y)),
      radius: Math.min(0.25, Math.max(0.002, spot.radius)),
      strength: Math.min(1, Math.max(0, spot.strength)),
    }));
}

function normalizeCloneStamps(value: unknown): CloneStamp[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((stamp): stamp is CloneStamp => stamp != null && typeof stamp === "object"
      && [stamp.x, stamp.y, stamp.sourceX, stamp.sourceY, stamp.radius, stamp.strength]
        .every((item) => typeof item === "number" && Number.isFinite(item)))
    .slice(-MAX_CLONE_STAMPS)
    .map((stamp) => ({
      x: Math.min(1, Math.max(0, stamp.x)), y: Math.min(1, Math.max(0, stamp.y)),
      sourceX: Math.min(1, Math.max(0, stamp.sourceX)), sourceY: Math.min(1, Math.max(0, stamp.sourceY)),
      radius: Math.min(0.25, Math.max(0.002, stamp.radius)), strength: Math.min(1, Math.max(0, stamp.strength)),
    }));
}

export function normalizeRetouchSettings(
  settings?: Partial<RetouchSettings> | null,
): RetouchSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(settings ?? {}) };
  return {
    ...merged,
    curve_rgb: normalizeCurve(merged.curve_rgb),
    curve_red: normalizeCurve(merged.curve_red),
    curve_green: normalizeCurve(merged.curve_green),
    curve_blue: normalizeCurve(merged.curve_blue),
    healing_spots: normalizeHealingSpots(merged.healing_spots),
    clone_stamps: normalizeCloneStamps(merged.clone_stamps),
  };
}

export const UNIFORM_NAMES = [
  "u_texSize",
  "u_exposure", "u_contrast", "u_highlights", "u_shadows", "u_whites", "u_blacks",
  "u_saturation", "u_vibrance", "u_temperature", "u_tint", "u_dehaze",
  "u_clarity", "u_sharpness", "u_blur", "u_skin_whiten",
  "u_rotation", "u_flip_horizontal", "u_flip_vertical",
  "u_crop_x", "u_crop_y", "u_crop_width", "u_crop_height",
  "u_hsl_red_h",     "u_hsl_red_s",     "u_hsl_red_l",
  "u_hsl_orange_h",  "u_hsl_orange_s",  "u_hsl_orange_l",
  "u_hsl_yellow_h",  "u_hsl_yellow_s",  "u_hsl_yellow_l",
  "u_hsl_green_h",   "u_hsl_green_s",   "u_hsl_green_l",
  "u_hsl_aqua_h",    "u_hsl_aqua_s",    "u_hsl_aqua_l",
  "u_hsl_blue_h",    "u_hsl_blue_s",    "u_hsl_blue_l",
  "u_hsl_purple_h",  "u_hsl_purple_s",  "u_hsl_purple_l",
  "u_hsl_magenta_h", "u_hsl_magenta_s", "u_hsl_magenta_l",
  "u_curve_rgb_a", "u_curve_rgb_b",
  "u_curve_red_a", "u_curve_red_b",
  "u_curve_green_a", "u_curve_green_b",
  "u_curve_blue_a", "u_curve_blue_b",
  "u_shadow_tone_hue", "u_shadow_tone_saturation",
  "u_highlight_tone_hue", "u_highlight_tone_saturation", "u_tone_balance",
  "u_heal_spots[0]",
  "u_clone_targets[0]", "u_clone_sources[0]",
  "u_face_detected",
  "u_eye_left_x", "u_eye_left_y", "u_eye_right_x", "u_eye_right_y",
  "u_face_cx", "u_face_width",
  "u_eye_enlarge", "u_eye_brighten", "u_slim_face",
  "u_eye_left_radius_x", "u_eye_left_radius_y",
  "u_eye_right_radius_x", "u_eye_right_radius_y",
] as const;

export const VS_SOURCE = `
  attribute vec2 a_position;
  varying vec2 v_texCoord;
  void main() {
    v_texCoord = a_position * 0.5 + 0.5;
    v_texCoord.y = 1.0 - v_texCoord.y;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

export const FS_SOURCE = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_image;
  uniform vec2 u_texSize;
  uniform float u_exposure;
  uniform float u_contrast;
  uniform float u_highlights;
  uniform float u_shadows;
  uniform float u_whites;
  uniform float u_blacks;
  uniform float u_saturation;
  uniform float u_vibrance;
  uniform float u_temperature;
  uniform float u_tint;
  uniform float u_dehaze;
  uniform float u_clarity;
  uniform float u_sharpness;
  uniform float u_blur;
  uniform float u_skin_whiten;
  uniform float u_rotation;
  uniform float u_flip_horizontal;
  uniform float u_flip_vertical;
  uniform float u_crop_x;
  uniform float u_crop_y;
  uniform float u_crop_width;
  uniform float u_crop_height;
  uniform float u_hsl_red_h;     uniform float u_hsl_red_s;     uniform float u_hsl_red_l;
  uniform float u_hsl_orange_h;  uniform float u_hsl_orange_s;  uniform float u_hsl_orange_l;
  uniform float u_hsl_yellow_h;  uniform float u_hsl_yellow_s;  uniform float u_hsl_yellow_l;
  uniform float u_hsl_green_h;   uniform float u_hsl_green_s;   uniform float u_hsl_green_l;
  uniform float u_hsl_aqua_h;    uniform float u_hsl_aqua_s;    uniform float u_hsl_aqua_l;
  uniform float u_hsl_blue_h;    uniform float u_hsl_blue_s;    uniform float u_hsl_blue_l;
  uniform float u_hsl_purple_h;  uniform float u_hsl_purple_s;  uniform float u_hsl_purple_l;
  uniform float u_hsl_magenta_h; uniform float u_hsl_magenta_s; uniform float u_hsl_magenta_l;
  uniform vec4 u_curve_rgb_a;   uniform float u_curve_rgb_b;
  uniform vec4 u_curve_red_a;   uniform float u_curve_red_b;
  uniform vec4 u_curve_green_a; uniform float u_curve_green_b;
  uniform vec4 u_curve_blue_a;  uniform float u_curve_blue_b;
  uniform float u_shadow_tone_hue;     uniform float u_shadow_tone_saturation;
  uniform float u_highlight_tone_hue;  uniform float u_highlight_tone_saturation;
  uniform float u_tone_balance;
  uniform vec4 u_heal_spots[16];
  uniform vec4 u_clone_targets[12];
  uniform vec2 u_clone_sources[12];
  uniform float u_face_detected;
  uniform float u_eye_left_x;  uniform float u_eye_left_y;
  uniform float u_eye_right_x; uniform float u_eye_right_y;
  uniform float u_face_cx;     uniform float u_face_width;
  uniform float u_eye_enlarge;
  uniform float u_eye_brighten;
  uniform float u_slim_face;
  uniform float u_eye_left_radius_x;  uniform float u_eye_left_radius_y;
  uniform float u_eye_right_radius_x; uniform float u_eye_right_radius_y;

  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  vec3 adjustSat(vec3 c, float s) {
    return mix(vec3(luma(c)), c, s);
  }

  vec3 rgb2hsl(vec3 c) {
    float maxC = max(c.r, max(c.g, c.b));
    float minC = min(c.r, min(c.g, c.b));
    float h = 0.0, s = 0.0, l = (maxC + minC) * 0.5;
    float d = maxC - minC;
    if (d > 0.0001) {
      s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
      if (maxC == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
      else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
      else h = (c.r - c.g) / d + 4.0;
      h /= 6.0;
    }
    return vec3(h, s, l);
  }

  float hue2rgb(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
    if (t < 0.5) return q;
    if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
    return p;
  }

  vec3 hsl2rgb(vec3 hsl) {
    float h = hsl.x, s = hsl.y, l = hsl.z;
    if (s < 0.0001) return vec3(l);
    float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
    float p = 2.0 * l - q;
    return vec3(hue2rgb(p, q, h + 1.0/3.0), hue2rgb(p, q, h), hue2rgb(p, q, h - 1.0/3.0));
  }

  vec3 applyHslChannel(vec3 hsl, float center, float halfW, float dH, float dS, float dL) {
    float d = abs(hsl.x - center);
    if (d > 0.5) d = 1.0 - d;
    float w = (1.0 - smoothstep(0.0, halfW, d)) * smoothstep(0.05, 0.15, hsl.y);
    if (w > 0.001) {
      hsl.x += dH * 0.005 * w;
      hsl.y = clamp(hsl.y * (1.0 + dS * 0.01 * w), 0.0, 1.0);
      hsl.z = clamp(hsl.z + dL * 0.003 * w, 0.0, 1.0);
    }
    return hsl;
  }

  float eyeEllipseMask(vec2 point, vec2 center, vec2 radius, float aspect) {
    vec2 delta = point - center;
    delta.x *= aspect;
    float normalized = length(vec2(delta.x / max(radius.x * aspect, 0.001), delta.y / max(radius.y, 0.001)));
    return 1.0 - smoothstep(0.72, 1.0, normalized);
  }

  float applyCurve(float value, vec4 firstFour, float lastPoint) {
    float scaled = clamp(value, 0.0, 1.0) * 4.0;
    if (scaled < 1.0) return mix(firstFour.x, firstFour.y, scaled);
    if (scaled < 2.0) return mix(firstFour.y, firstFour.z, scaled - 1.0);
    if (scaled < 3.0) return mix(firstFour.z, firstFour.w, scaled - 2.0);
    return mix(firstFour.w, lastPoint, scaled - 3.0);
  }

  void main() {
    float sx = 1.0 / u_texSize.x;
    float sy = 1.0 / u_texSize.y;
    float aspect = u_texSize.x / u_texSize.y;

    // 先从裁剪后的显示坐标逆映射到原始纹理坐标。
    vec2 displayCoord = vec2(
      u_crop_x + v_texCoord.x * u_crop_width,
      u_crop_y + v_texCoord.y * u_crop_height
    );
    if (u_flip_horizontal > 0.5) displayCoord.x = 1.0 - displayCoord.x;
    if (u_flip_vertical > 0.5) displayCoord.y = 1.0 - displayCoord.y;
    vec2 sampleCoord;
    if (u_rotation < 0.5) sampleCoord = displayCoord;
    else if (u_rotation < 1.5) sampleCoord = vec2(displayCoord.y, 1.0 - displayCoord.x);
    else if (u_rotation < 2.5) sampleCoord = vec2(1.0 - displayCoord.x, 1.0 - displayCoord.y);
    else sampleCoord = vec2(1.0 - displayCoord.y, displayCoord.x);

    // 面部形变（大眼/瘦脸）：在源纹理坐标中计算偏移。
    if (u_face_detected > 0.5) {
      float enlarge = u_eye_enlarge * 0.003;
      float eyeR = 0.09;
      vec2 eyeL = vec2(u_eye_left_x, u_eye_left_y);
      vec2 eyeR2 = vec2(u_eye_right_x, u_eye_right_y);
      // 大眼：以眼中心为圆心，向内收缩采样坐标（逆映射）
      if (enlarge > 0.001) {
        vec2 dL = sampleCoord - eyeL;
        dL.x *= aspect;
        float distL = length(dL);
        if (distL < eyeR) {
          float t = distL / eyeR;
          sampleCoord = sampleCoord - (sampleCoord - eyeL) * enlarge * (1.0 - t * t);
        }
        vec2 dR = sampleCoord - eyeR2;
        dR.x *= aspect;
        float distR = length(dR);
        if (distR < eyeR) {
          float t2 = distR / eyeR;
          sampleCoord = sampleCoord - (sampleCoord - eyeR2) * enlarge * (1.0 - t2 * t2);
        }
      }
      // 瘦脸：在脸宽范围内水平向中心轴挤压
      float slim = u_slim_face * 0.002;
      if (slim > 0.001) {
        float halfW = u_face_width * 0.5;
        float dx = sampleCoord.x - u_face_cx;
        float distFace = abs(dx);
        if (distFace < halfW) {
          float t3 = distFace / halfW;
          sampleCoord.x -= sign(dx) * slim * (1.0 - t3 * t3);
        }
      }
      sampleCoord = clamp(sampleCoord, 0.0, 1.0);
    }

    vec4 orig = texture2D(u_image, sampleCoord);
    vec3 rgb = orig.rgb;

    // 污点修复：取修复点外围四向纹理均值，并在笔刷边缘羽化融合。
    for (int i = 0; i < 16; i++) {
      vec4 spot = u_heal_spots[i];
      if (spot.z > 0.0) {
        vec2 delta = sampleCoord - spot.xy;
        delta.x *= aspect;
        float spotDistance = length(delta);
        if (spotDistance < spot.z) {
          float ring = spot.z * 1.35;
          vec3 replacement =
            texture2D(u_image, spot.xy + vec2( ring / aspect, 0.0)).rgb +
            texture2D(u_image, spot.xy + vec2(-ring / aspect, 0.0)).rgb +
            texture2D(u_image, spot.xy + vec2(0.0,  ring)).rgb +
            texture2D(u_image, spot.xy + vec2(0.0, -ring)).rgb;
          replacement *= 0.25;
          float feather = 1.0 - smoothstep(spot.z * 0.62, spot.z, spotDistance);
          rgb = mix(rgb, replacement, feather * spot.w);
        }
      }
    }

    // 仿制图章：按目标点内的相对位移，从对应源点读取纹理。
    for (int i = 0; i < 12; i++) {
      vec4 target = u_clone_targets[i];
      if (target.z > 0.0) {
        vec2 cloneDelta = sampleCoord - target.xy;
        cloneDelta.x *= aspect;
        float cloneDistance = length(cloneDelta);
        if (cloneDistance < target.z) {
          vec2 sourceDelta = sampleCoord - target.xy;
          vec2 cloneCoord = clamp(u_clone_sources[i] + sourceDelta, 0.0, 1.0);
          vec3 cloned = texture2D(u_image, cloneCoord).rgb;
          float cloneFeather = 1.0 - smoothstep(target.z * 0.62, target.z, cloneDistance);
          rgb = mix(rgb, cloned, cloneFeather * target.w);
        }
      }
    }

    // 磨皮：双边滤波（动态步长）
    if (u_blur > 0.0) {
      vec3 sum = vec3(0.0);
      float tw = 0.0;
      for (int x = -2; x <= 2; x++) {
        for (int y = -2; y <= 2; y++) {
          vec2 off = vec2(float(x) * sx, float(y) * sy);
          vec3 nb = texture2D(u_image, sampleCoord + off).rgb;
          float cd = distance(rgb, nb);
          float w = exp(-cd * cd * 15.0);
          sum += nb * w; tw += w;
        }
      }
      if (tw > 0.0) rgb = mix(rgb, sum / tw, u_blur);
    }

    // 锐化：Laplacian 反锐化
    if (u_sharpness > 0.0) {
      vec3 nb4 =
        texture2D(u_image, sampleCoord + vec2( sx, 0.0)).rgb +
        texture2D(u_image, sampleCoord + vec2(-sx, 0.0)).rgb +
        texture2D(u_image, sampleCoord + vec2(0.0,  sy)).rgb +
        texture2D(u_image, sampleCoord + vec2(0.0, -sy)).rgb;
      rgb += (rgb * 4.0 - nb4) * u_sharpness * 0.04;
    }

    // 清晰度：局部对比（与模糊结果之差叠加）
    if (abs(u_clarity) > 0.001) {
      vec3 soft = vec3(0.0); float cw = 0.0;
      for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
          vec3 nb = texture2D(u_image, sampleCoord + vec2(float(x)*sx*3.0, float(y)*sy*3.0)).rgb;
          soft += nb; cw += 1.0;
        }
      }
      soft /= cw;
      rgb += (rgb - soft) * u_clarity * 0.5;
    }

    // 亮眼：只提亮眼裂内明亮、低饱和的眼白，避免把虹膜和眼周皮肤一起漂白。
    if (u_eye_brighten > 0.001 && u_face_detected > 0.5) {
      float eyeMask = max(
        eyeEllipseMask(sampleCoord, vec2(u_eye_left_x, u_eye_left_y), vec2(u_eye_left_radius_x, u_eye_left_radius_y), aspect),
        eyeEllipseMask(sampleCoord, vec2(u_eye_right_x, u_eye_right_y), vec2(u_eye_right_radius_x, u_eye_right_radius_y), aspect)
      );
      float eyeLuma = luma(rgb);
      float chroma = length(rgb - vec3(eyeLuma));
      float whiteMask = eyeMask * smoothstep(0.32, 0.62, eyeLuma) * (1.0 - smoothstep(0.08, 0.28, chroma));
      float strength = u_eye_brighten * 0.0035 * whiteMask;
      rgb += vec3(strength);
      rgb = mix(rgb, vec3(luma(rgb)), min(0.18, strength * 0.35));
    }

    float L = luma(rgb);

    // 曝光
    rgb *= (1.0 + u_exposure * 0.01);

    // 高光 / 阴影 / 白色 / 黑色
    float hMask = smoothstep(0.5, 1.0, L);
    float sMask = 1.0 - smoothstep(0.0, 0.5, L);
    float wMask = smoothstep(0.8, 1.0, L);
    float bMask = 1.0 - smoothstep(0.0, 0.2, L);
    rgb += vec3(u_highlights * 0.003) * hMask;
    rgb += vec3(u_shadows   * 0.003) * sMask;
    rgb += vec3(u_whites    * 0.002) * wMask;
    rgb += vec3(u_blacks    * 0.002) * bMask;

    // 对比度
    rgb = (rgb - 0.5) * (1.0 + u_contrast * 0.01) + 0.5;

    // 色温 (负=冷蓝, 正=暖橙)
    rgb.r += u_temperature * 0.0008;
    rgb.b -= u_temperature * 0.0008;

    // 色调 (负=品红, 正=绿)
    rgb.g += u_tint * 0.0004;
    rgb.r -= u_tint * 0.0002;
    rgb.b -= u_tint * 0.0002;

    // 饱和度
    rgb = adjustSat(rgb, 1.0 + u_saturation * 0.01);

    // 自然饱和度（保护已高饱和区域）
    if (abs(u_vibrance) > 0.001) {
      float curSat = length(rgb - vec3(luma(rgb)));
      rgb = mix(vec3(luma(rgb)), rgb, 1.0 + u_vibrance * 0.01 * (1.0 - curSat * 1.5));
    }

    // 去朦胧（对比+饱和双重增强）
    if (u_dehaze > 0.001) {
      rgb = (rgb - 0.5) * (1.0 + u_dehaze * 0.005) + 0.5;
      rgb = adjustSat(rgb, 1.0 + u_dehaze * 0.003);
    }

    // 美白（肤色区域选择性提亮）
    if (u_skin_whiten > 0.001) {
      float skinMask = smoothstep(0.3, 0.7, rgb.r)
        * (1.0 - smoothstep(0.1, 0.45, rgb.b))
        * smoothstep(0.2, 0.6, luma(rgb));
      rgb += vec3(u_skin_whiten * 0.0015) * skinMask;
    }

    // HSL 分色调整
    vec3 hsl = rgb2hsl(rgb);
    hsl = applyHslChannel(hsl, 0.0,   0.05,  u_hsl_red_h,     u_hsl_red_s,     u_hsl_red_l);
    hsl = applyHslChannel(hsl, 0.069, 0.027, u_hsl_orange_h,  u_hsl_orange_s,  u_hsl_orange_l);
    hsl = applyHslChannel(hsl, 0.132, 0.035, u_hsl_yellow_h,  u_hsl_yellow_s,  u_hsl_yellow_l);
    hsl = applyHslChannel(hsl, 0.271, 0.1,   u_hsl_green_h,   u_hsl_green_s,   u_hsl_green_l);
    hsl = applyHslChannel(hsl, 0.438, 0.062, u_hsl_aqua_h,    u_hsl_aqua_s,    u_hsl_aqua_l);
    hsl = applyHslChannel(hsl, 0.583, 0.083, u_hsl_blue_h,    u_hsl_blue_s,    u_hsl_blue_l);
    hsl = applyHslChannel(hsl, 0.729, 0.062, u_hsl_purple_h,  u_hsl_purple_s,  u_hsl_purple_l);
    hsl = applyHslChannel(hsl, 0.875, 0.083, u_hsl_magenta_h, u_hsl_magenta_s, u_hsl_magenta_l);
    hsl.x = fract(hsl.x + 1.0);
    rgb = hsl2rgb(hsl);

    // 色调映射：只注入目标色的色度分量，尽量保持原始明暗层次。
    float toneMidpoint = 0.5 - u_tone_balance * 0.0025;
    float toneLuma = luma(rgb);
    float shadowToneMask = 1.0 - smoothstep(toneMidpoint - 0.25, toneMidpoint + 0.15, toneLuma);
    float highlightToneMask = smoothstep(toneMidpoint - 0.15, toneMidpoint + 0.25, toneLuma);
    vec3 shadowToneColor = hsl2rgb(vec3(fract(u_shadow_tone_hue / 360.0), 1.0, 0.5));
    vec3 highlightToneColor = hsl2rgb(vec3(fract(u_highlight_tone_hue / 360.0), 1.0, 0.5));
    vec3 shadowChroma = shadowToneColor - vec3(luma(shadowToneColor));
    vec3 highlightChroma = highlightToneColor - vec3(luma(highlightToneColor));
    rgb += shadowChroma * (u_shadow_tone_saturation * 0.0035 * shadowToneMask);
    rgb += highlightChroma * (u_highlight_tone_saturation * 0.0035 * highlightToneMask);

    // 主 RGB 曲线控制整体明暗，随后叠加各颜色通道曲线。
    rgb = vec3(
      applyCurve(rgb.r, u_curve_rgb_a, u_curve_rgb_b),
      applyCurve(rgb.g, u_curve_rgb_a, u_curve_rgb_b),
      applyCurve(rgb.b, u_curve_rgb_a, u_curve_rgb_b)
    );
    rgb.r = applyCurve(rgb.r, u_curve_red_a, u_curve_red_b);
    rgb.g = applyCurve(rgb.g, u_curve_green_a, u_curve_green_b);
    rgb.b = applyCurve(rgb.b, u_curve_blue_a, u_curve_blue_b);

    gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), orig.a);
  }
`;

export const PRESET_EFFECTS = [
  { name: "无效果",    settings: { ...DEFAULT_SETTINGS } },
  { name: "透感肌",   settings: { ...DEFAULT_SETTINGS, exposure: 10, contrast: 5,  saturation: -5,  blur_strength: 60, eye_enlarge: 15, slim_face: 10, temperature: -5,  skin_whiten: 20 } },
  { name: "妆容肌",   settings: { ...DEFAULT_SETTINGS, exposure: 15, contrast: 10, saturation: 5,   blur_strength: 70, eye_enlarge: 20, slim_face: 15, highlights: 10,   skin_whiten: 15 } },
  { name: "混色肌",   settings: { ...DEFAULT_SETTINGS, exposure: 6,  contrast: -4, saturation: 8,   blur_strength: 50, eye_enlarge: 15, slim_face: 10, vibrance: 15     } },
  { name: "肤色-中性",settings: { ...DEFAULT_SETTINGS, exposure: 10, contrast: 2,  saturation: -8,  blur_strength: 60, eye_enlarge: 12, slim_face: 10, skin_whiten: 10  } },
  { name: "肤色-清冷",settings: { ...DEFAULT_SETTINGS, exposure: 14, contrast: 4,  saturation: -12, blur_strength: 60, eye_enlarge: 12, slim_face: 10, temperature: -15 } },
  { name: "暖秒",     settings: { ...DEFAULT_SETTINGS, exposure: 16, contrast: -6, saturation: 14,  blur_strength: 50, eye_enlarge: 10, slim_face: 6,  temperature: 20  } },
  { name: "暖砂",     settings: { ...DEFAULT_SETTINGS, exposure: 18, contrast: -8, saturation: 10,  blur_strength: 55, eye_enlarge: 14, slim_face: 10, temperature: 15,  shadows: 10 } },
  { name: "儿童-清新",settings: { ...DEFAULT_SETTINGS, exposure: 20, contrast: -10,saturation: 8,   blur_strength: 50, eye_enlarge: 12, slim_face: 4,  vibrance: 10,     clarity: 5  } },
  { name: "孕妇-温和",settings: { ...DEFAULT_SETTINGS, exposure: 12, contrast: -4, saturation: 6,   blur_strength: 58, eye_enlarge: 16, slim_face: 12, skin_whiten: 15,  temperature: 5 } },
];
