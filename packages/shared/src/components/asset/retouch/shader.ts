import { buildPortraitDefines, PORTRAIT_VEC4_COUNT } from "./portraitParams";
import { buildFacePointDefines, FACE_POINT_VEC4_COUNT } from "./faceUniforms";
import { GLSL_COMMON } from "./glsl/common";
import { GLSL_PORTRAIT_WARP } from "./glsl/portraitWarp";
import { GLSL_PORTRAIT_COLOR } from "./glsl/portraitColor";
import { GLSL_BODY_WARP } from "./glsl/bodyWarp";
import { LIQUIFY_MAX_SHIFT, MAX_CLONE_STAMPS, MAX_HEALING_SPOTS, MAX_LOCAL_MASKS } from "./settings";
import { LOCAL_MASK_ATLAS_COLUMNS, LOCAL_MASK_ATLAS_ROWS, LOCAL_MASK_TILE_SIZE } from "./localMasks";

export const VS_SOURCE = `
  attribute vec2 a_position;
  varying vec2 v_texCoord;
  void main() {
    v_texCoord = a_position * 0.5 + 0.5;
    v_texCoord.y = 1.0 - v_texCoord.y;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

/** 关键点坐标运算对精度敏感，能用 highp 就不用 mediump */
const PRECISION = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif
`;

const UNIFORM_DECLARATIONS = `
  varying vec2 v_texCoord;
  uniform sampler2D u_image;
  uniform vec2 u_texSize;
  // 光影 / 色彩 / 细节
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
  uniform float u_grain_amount;
  uniform float u_grain_size;
  uniform float u_grain_roughness;
  uniform float u_lens_distortion;
  uniform float u_vignette_amount;
  uniform float u_vignette_midpoint;
  uniform float u_vignette_feather;
  uniform float u_vignette_roundness;
  uniform float u_body_center_x;
  uniform float u_body_waist_y;
  uniform float u_body_waist;
  uniform float u_body_shoulders;
  uniform float u_body_hips;
  uniform float u_body_legs;
  uniform float u_body_leg_length;
  uniform float u_border_enabled;
  uniform float u_border_size;
  uniform float u_border_radius;
  uniform vec3 u_border_color;
  // 几何
  uniform float u_rotation;
  uniform float u_flip_horizontal;
  uniform float u_flip_vertical;
  uniform float u_crop_x;
  uniform float u_crop_y;
  uniform float u_crop_width;
  uniform float u_crop_height;
  // HSL 八通道
  uniform float u_hsl_red_h;     uniform float u_hsl_red_s;     uniform float u_hsl_red_l;
  uniform float u_hsl_orange_h;  uniform float u_hsl_orange_s;  uniform float u_hsl_orange_l;
  uniform float u_hsl_yellow_h;  uniform float u_hsl_yellow_s;  uniform float u_hsl_yellow_l;
  uniform float u_hsl_green_h;   uniform float u_hsl_green_s;   uniform float u_hsl_green_l;
  uniform float u_hsl_aqua_h;    uniform float u_hsl_aqua_s;    uniform float u_hsl_aqua_l;
  uniform float u_hsl_blue_h;    uniform float u_hsl_blue_s;    uniform float u_hsl_blue_l;
  uniform float u_hsl_purple_h;  uniform float u_hsl_purple_s;  uniform float u_hsl_purple_l;
  uniform float u_hsl_magenta_h; uniform float u_hsl_magenta_s; uniform float u_hsl_magenta_l;
  // 曲线
  uniform vec4 u_curve_rgb_a;   uniform float u_curve_rgb_b;
  uniform vec4 u_curve_red_a;   uniform float u_curve_red_b;
  uniform vec4 u_curve_green_a; uniform float u_curve_green_b;
  uniform vec4 u_curve_blue_a;  uniform float u_curve_blue_b;
  // 色调映射
  uniform float u_shadow_tone_hue;     uniform float u_shadow_tone_saturation;
  uniform float u_highlight_tone_hue;  uniform float u_highlight_tone_saturation;
  uniform float u_tone_balance;
  // 局部修复
  uniform vec4 u_heal_spots[${MAX_HEALING_SPOTS}];
  uniform vec4 u_clone_targets[${MAX_CLONE_STAMPS}];
  uniform vec2 u_clone_sources[${MAX_CLONE_STAMPS}];
  // 人脸关键点与人像参数（打包上传，宏由 TS 侧声明表自动生成）
  uniform float u_face_detected;
  uniform vec4 u_face_pts[${FACE_POINT_VEC4_COUNT}];
  uniform vec4 u_face_scale;
  uniform float u_eye_left_radius_x;  uniform float u_eye_left_radius_y;
  uniform float u_eye_right_radius_x; uniform float u_eye_right_radius_y;
  uniform vec4 u_portrait[${PORTRAIT_VEC4_COUNT}];
  // 液化位移贴图（RG 编码，0.5 为零位移）
  uniform sampler2D u_liquify_map;
  uniform float u_liquify_enabled;
  // 3D LUT
  uniform sampler2D u_lut;
  uniform float u_lut_enabled;
  uniform float u_lut_size;
  uniform float u_lut_intensity;
  // AI 抠图前景与背景合成
  uniform sampler2D u_cutout;
  uniform sampler2D u_background_image;
  uniform float u_cutout_enabled;
  uniform float u_background_mode;
  uniform vec3 u_background_color;
  uniform float u_background_blur;
  uniform float u_background_image_ready;
  uniform vec2 u_background_image_size;
  uniform float u_background_image_scale;
  uniform vec2 u_background_image_offset;
  // 多局部蒙版：画笔选区使用图集，其余选区由几何或颜色范围实时计算。
  uniform sampler2D u_local_mask_atlas;
  uniform vec4 u_local_meta[${MAX_LOCAL_MASKS}];
  uniform vec4 u_local_geometry_a[${MAX_LOCAL_MASKS}];
  uniform vec4 u_local_geometry_b[${MAX_LOCAL_MASKS}];
  uniform vec4 u_local_range[${MAX_LOCAL_MASKS}];
  uniform vec4 u_local_sample[${MAX_LOCAL_MASKS}];
  uniform vec4 u_local_adjust_a[${MAX_LOCAL_MASKS}];
  uniform vec4 u_local_adjust_b[${MAX_LOCAL_MASKS}];
  uniform float u_local_preview_index;
  uniform float u_local_preview_enabled;
`;

const GLSL_LOCAL_MASKS = `
  float hueDistance(float a, float b) {
    float distance = abs(a - b);
    return min(distance, 1.0 - distance);
  }

  float sampleBrushMask(int index, vec2 coord) {
    float maskIndex = float(index);
    float column = mod(maskIndex, ${LOCAL_MASK_ATLAS_COLUMNS.toFixed(1)});
    float row = floor(maskIndex / ${LOCAL_MASK_ATLAS_COLUMNS.toFixed(1)});
    float inset = 0.5 / ${LOCAL_MASK_TILE_SIZE.toFixed(1)};
    vec2 localCoord = clamp(coord, vec2(inset), vec2(1.0 - inset));
    vec2 atlasCoord = (localCoord + vec2(column, row))
      / vec2(${LOCAL_MASK_ATLAS_COLUMNS.toFixed(1)}, ${LOCAL_MASK_ATLAS_ROWS.toFixed(1)});
    return texture2D(u_local_mask_atlas, atlasCoord).r;
  }

  float localMaskValue(
    int index, vec2 coord, vec3 sourceRgb, float aspect,
    vec4 meta, vec4 geometryA, vec4 geometryB, vec4 range,
    vec4 sampleRange, vec4 adjustmentB
  ) {
    if (meta.y < 0.5 || meta.x < 0.5) return 0.0;
    float feather = max(geometryB.y, 0.001);
    float mask = 0.0;

    if (meta.x < 1.5) {
      mask = sampleBrushMask(index, coord);
      if (sampleRange.w >= 0.0) {
        vec3 sourceHsl = rgb2hsl(clamp(sourceRgb, 0.0, 1.0));
        float difference = hueDistance(sourceHsl.x, sampleRange.x) * 1.8
          + abs(sourceHsl.y - sampleRange.y) * 0.35
          + abs(sourceHsl.z - sampleRange.z) * 0.65;
        mask *= 1.0 - smoothstep(sampleRange.w * 0.45, sampleRange.w, difference);
      }
    } else if (meta.x < 2.5) {
      vec2 direction = geometryA.zw - geometryA.xy;
      direction.x *= aspect;
      vec2 delta = coord - geometryA.xy;
      delta.x *= aspect;
      float projection = dot(delta, direction) / max(dot(direction, direction), 0.00001);
      mask = smoothstep(0.5 - feather * 0.5, 0.5 + feather * 0.5, projection);
    } else if (meta.x < 3.5) {
      float angle = radians(geometryB.x);
      float cosine = cos(angle);
      float sine = sin(angle);
      vec2 delta = coord - geometryA.xy;
      vec2 rotated = vec2(cosine * delta.x + sine * delta.y, -sine * delta.x + cosine * delta.y);
      float radialDistance = length(rotated / max(geometryA.zw, vec2(0.001)));
      mask = 1.0 - smoothstep(1.0 - feather, 1.0, radialDistance);
    } else if (meta.x < 4.5) {
      vec3 sourceHsl = rgb2hsl(clamp(sourceRgb, 0.0, 1.0));
      float colorWeight = 1.0 - smoothstep(range.y * 0.55, range.y, hueDistance(sourceHsl.x, range.x));
      float saturationWeight = smoothstep(adjustmentB.y, min(1.0, adjustmentB.y + 0.12), sourceHsl.y);
      mask = colorWeight * saturationWeight;
    } else {
      float sourceLuma = luma(sourceRgb);
      float edge = feather * 0.25;
      float lower = smoothstep(range.z - edge, range.z + edge, sourceLuma);
      float upper = 1.0 - smoothstep(range.w - edge, range.w + edge, sourceLuma);
      mask = lower * upper;
    }

    if (meta.w > 0.5) mask = 1.0 - mask;
    return clamp(mask * meta.z, 0.0, 1.0);
  }

  vec3 applyLocalAdjustment(vec3 color, vec4 adjustmentA, vec4 adjustmentB) {
    vec3 adjusted = color * (1.0 + adjustmentA.x * 0.01);
    adjusted = (adjusted - 0.5) * (1.0 + adjustmentA.y * 0.01) + 0.5;
    adjusted = adjustSat(adjusted, 1.0 + adjustmentA.z * 0.01);
    adjusted.r += adjustmentA.w * 0.0008;
    adjusted.b -= adjustmentA.w * 0.0008;
    adjusted.g += adjustmentB.x * 0.0004;
    adjusted.r -= adjustmentB.x * 0.0002;
    adjusted.b -= adjustmentB.x * 0.0002;
    return adjusted;
  }
`;

const MAIN_SOURCE = `
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

    // 镜头畸变校正：负值校正桶形，正值校正枕形。
    if (abs(u_lens_distortion) > 0.001) {
      vec2 lensDelta = sampleCoord - 0.5;
      lensDelta.x *= aspect;
      float radius2 = dot(lensDelta, lensDelta);
      float lensScale = 1.0 + u_lens_distortion * 0.004 * radius2;
      lensDelta *= lensScale;
      lensDelta.x /= aspect;
      sampleCoord = clamp(0.5 + lensDelta, 0.0, 1.0);
    }

    // 液化：手绘位移贴图，笔画数不受 uniform 数量限制
    if (u_liquify_enabled > 0.5) {
      vec2 shift = (texture2D(u_liquify_map, sampleCoord).rg - 0.5) * ${(LIQUIFY_MAX_SHIFT * 2).toFixed(4)};
      sampleCoord = clamp(sampleCoord + shift, 0.0, 1.0);
    }

    // 人脸形变（大眼 / 瘦脸 / 五官精调等）
    sampleCoord = clamp(applyFaceWarp(sampleCoord, aspect), 0.0, 1.0);

    vec4 orig = texture2D(u_image, sampleCoord);
    vec3 rgb = orig.rgb;

    // 污点修复：取修复点外围四向纹理均值，并在笔刷边缘羽化融合。
    for (int i = 0; i < ${MAX_HEALING_SPOTS}; i++) {
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
    for (int i = 0; i < ${MAX_CLONE_STAMPS}; i++) {
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

    // 人像精修（祛瑕疵 / 祛纹 / 磨皮 / 肤色 / 五官润饰）
    rgb = applyPortraitColor(rgb, sampleCoord, aspect, sx, sy);

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

    // HSL 分色调整
    vec3 hsl = rgb2hsl(clamp(rgb, 0.0, 1.0));
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

    // 局部蒙版依次叠加，每个蒙版拥有独立调色参数。
    float previewMask = 0.0;
    for (int localIndex = 0; localIndex < ${MAX_LOCAL_MASKS}; localIndex++) {
      float mask = localMaskValue(
        localIndex, sampleCoord, orig.rgb, aspect,
        u_local_meta[localIndex], u_local_geometry_a[localIndex], u_local_geometry_b[localIndex],
        u_local_range[localIndex], u_local_sample[localIndex], u_local_adjust_b[localIndex]
      );
      if (mask > 0.001) {
        vec3 localAdjusted = applyLocalAdjustment(
          rgb, u_local_adjust_a[localIndex], u_local_adjust_b[localIndex]
        );
        rgb = mix(rgb, localAdjusted, mask);
      }
      if (abs(float(localIndex) - u_local_preview_index) < 0.25) previewMask = mask;
    }

    sampleCoord = clamp(applyBodyWarp(sampleCoord, aspect), 0.0, 1.0);

    if (u_local_preview_enabled > 0.5 && previewMask > 0.001) {
      rgb = mix(rgb, vec3(1.0, 0.12, 0.08), previewMask * 0.38);
    }

    // 3D LUT 位于管线末端，作为整体创意调色叠加。
    if (u_lut_enabled > 0.5) {
      vec3 graded = sampleLut(u_lut, clamp(rgb, 0.0, 1.0), u_lut_size);
      rgb = mix(rgb, graded, clamp(u_lut_intensity * 0.01, 0.0, 1.0));
    }

    vec3 finalRgb = clamp(rgb, 0.0, 1.0);
    float finalAlpha = orig.a;
    if (u_cutout_enabled > 0.5 && u_background_mode > 0.5) {
      float subjectAlpha = texture2D(u_cutout, sampleCoord).a;
      if (u_background_mode < 1.5) {
        finalAlpha = subjectAlpha;
      } else {
        vec3 background = u_background_color;
        if (u_background_mode > 2.5 && u_background_mode < 3.5) {
          vec3 blurred = vec3(0.0);
          float blurRadius = max(u_background_blur, 0.0);
          for (int bx = -2; bx <= 2; bx++) {
            for (int by = -2; by <= 2; by++) {
              vec2 offset = vec2(float(bx), float(by)) * blurRadius / u_texSize;
              blurred += texture2D(u_image, clamp(sampleCoord + offset, 0.0, 1.0)).rgb;
            }
          }
          background = blurred / 25.0;
        } else if (u_background_mode > 3.5 && u_background_image_ready > 0.5) {
          float canvasAspect = u_texSize.x / max(u_texSize.y, 1.0);
          float imageAspect = u_background_image_size.x / max(u_background_image_size.y, 1.0);
          vec2 backgroundCoord = v_texCoord;
          if (imageAspect > canvasAspect) {
            backgroundCoord.x = 0.5 + (backgroundCoord.x - 0.5) * canvasAspect / imageAspect;
          } else {
            backgroundCoord.y = 0.5 + (backgroundCoord.y - 0.5) * imageAspect / canvasAspect;
          }
          backgroundCoord = (backgroundCoord - 0.5) / max(u_background_image_scale, 0.01)
            + 0.5 - u_background_image_offset;
          background = texture2D(u_background_image, clamp(backgroundCoord, 0.0, 1.0)).rgb;
        }
        finalRgb = mix(background, finalRgb, subjectAlpha);
        finalAlpha = 1.0;
      }
    }
    // 暗角在背景合成后执行，使替换后的背景与主体保持统一光学观感。
    if (abs(u_vignette_amount) > 0.001) {
      vec2 vignetteCoord = abs(v_texCoord - 0.5) * 2.0;
      float roundness = u_vignette_roundness * 0.005;
      vignetteCoord.x *= mix(1.0, u_texSize.x / max(u_texSize.y, 1.0), roundness);
      float vignetteDistance = length(vignetteCoord) / 1.41421356;
      float midpoint = mix(0.12, 0.82, u_vignette_midpoint * 0.01);
      float feather = mix(0.02, 0.72, u_vignette_feather * 0.01);
      float vignetteMask = smoothstep(midpoint, midpoint + feather, vignetteDistance);
      float amount = u_vignette_amount * 0.008 * vignetteMask;
      finalRgb = amount >= 0.0
        ? finalRgb * (1.0 - amount)
        : 1.0 - (1.0 - finalRgb) * (1.0 + amount);
    }

    // 胶片颗粒由输出像素坐标生成，不随缩放预览改变颗粒密度。
    if (u_grain_amount > 0.001) {
      float grainScale = mix(1.8, 0.18, u_grain_size * 0.01);
      vec2 grainCoord = floor(gl_FragCoord.xy * grainScale);
      float fineNoise = fract(sin(dot(grainCoord, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      float coarseNoise = fract(sin(dot(floor(grainCoord * 0.37), vec2(39.3468, 11.135))) * 24634.6345) - 0.5;
      float noise = mix(fineNoise, coarseNoise, u_grain_roughness * 0.01);
      float midtoneProtection = 0.55 + 0.45 * (1.0 - abs(luma(finalRgb) - 0.5) * 2.0);
      finalRgb += noise * u_grain_amount * 0.0032 * midtoneProtection;
    }

    if (u_border_enabled > 0.5 && u_border_size > 0.001) {
      float borderWidth = u_border_size * 0.005;
      float radius = u_border_radius * 0.004;
      vec2 innerHalf = vec2(max(0.01, 0.5 - borderWidth));
      vec2 rounded = abs(v_texCoord - 0.5) - innerHalf + radius;
      float innerDistance = length(max(rounded, 0.0)) + min(max(rounded.x, rounded.y), 0.0) - radius;
      float borderMask = smoothstep(-0.0025, 0.0025, innerDistance);
      finalRgb = mix(finalRgb, u_border_color, borderMask);
      finalAlpha = mix(finalAlpha, 1.0, borderMask);
    }

    gl_FragColor = vec4(clamp(finalRgb, 0.0, 1.0), finalAlpha);
  }
`;

const GLSL_HSL_CHANNEL = `
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
`;

export const FS_SOURCE = [
  PRECISION,
  UNIFORM_DECLARATIONS,
  `  ${buildPortraitDefines()}`,
  `  ${buildFacePointDefines()}`,
  GLSL_COMMON,
  GLSL_HSL_CHANNEL,
  GLSL_LOCAL_MASKS,
  GLSL_BODY_WARP,
  GLSL_PORTRAIT_WARP,
  GLSL_PORTRAIT_COLOR,
  MAIN_SOURCE,
].join("\n");

/** 需要在链接后查询位置的 uniform 名称 */
export const UNIFORM_NAMES = [
  "u_texSize",
  "u_exposure", "u_contrast", "u_highlights", "u_shadows", "u_whites", "u_blacks",
  "u_saturation", "u_vibrance", "u_temperature", "u_tint", "u_dehaze",
  "u_clarity", "u_sharpness",
  "u_grain_amount", "u_grain_size", "u_grain_roughness",
  "u_lens_distortion",
  "u_vignette_amount", "u_vignette_midpoint", "u_vignette_feather", "u_vignette_roundness",
  "u_body_center_x", "u_body_waist_y", "u_body_waist", "u_body_shoulders",
  "u_body_hips", "u_body_legs", "u_body_leg_length",
  "u_border_enabled", "u_border_size", "u_border_radius", "u_border_color",
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
  "u_face_detected", "u_face_pts[0]", "u_face_scale",
  "u_eye_left_radius_x", "u_eye_left_radius_y",
  "u_eye_right_radius_x", "u_eye_right_radius_y",
  "u_portrait[0]",
  "u_image", "u_liquify_map", "u_liquify_enabled",
  "u_lut", "u_lut_enabled", "u_lut_size", "u_lut_intensity",
  "u_cutout", "u_background_image", "u_cutout_enabled", "u_background_mode",
  "u_background_color", "u_background_blur", "u_background_image_ready",
  "u_background_image_size", "u_background_image_scale", "u_background_image_offset",
  "u_local_mask_atlas", "u_local_meta[0]", "u_local_geometry_a[0]", "u_local_geometry_b[0]",
  "u_local_range[0]", "u_local_sample[0]", "u_local_adjust_a[0]", "u_local_adjust_b[0]",
  "u_local_preview_index", "u_local_preview_enabled",
] as const;
