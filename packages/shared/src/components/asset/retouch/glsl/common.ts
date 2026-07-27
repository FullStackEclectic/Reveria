/** 色彩空间转换、区域遮罩与采样工具，供调色与人像两条管线共用。 */
export const GLSL_COMMON = `
  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  /** 色度强度：与同亮度灰之间的距离，用于区分皮肤与彩妆、眼白与虹膜 */
  float chroma(vec3 c) { return length(c - vec3(luma(c))); }

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

  /**
   * 基于 YCbCr 的肤色判定。相比直接比较 RGB 分量，对深浅肤色与偏色光源都更稳健，
   * 因此磨皮、祛瑕疵、祛油光等只应作用于皮肤的效果都以它为准。
   */
  float skinMask(vec3 c) {
    float y  = luma(c);
    float cb = -0.168736 * c.r - 0.331264 * c.g + 0.5 * c.b + 0.5;
    float cr =  0.5 * c.r - 0.418688 * c.g - 0.081312 * c.b + 0.5;
    float m = smoothstep(0.27, 0.33, cb) * (1.0 - smoothstep(0.47, 0.53, cb));
    m *= smoothstep(0.49, 0.53, cr) * (1.0 - smoothstep(0.65, 0.70, cr));
    m *= smoothstep(0.12, 0.26, y) * (1.0 - smoothstep(0.93, 1.0, y));
    return clamp(m, 0.0, 1.0);
  }

  /** 椭圆区域遮罩，中心为 1、边缘平滑衰减到 0 */
  float ellipseMask(vec2 p, vec2 center, vec2 radius, float aspect) {
    vec2 d = p - center;
    d.x *= aspect;
    float n = length(vec2(
      d.x / max(radius.x * aspect, 0.0001),
      d.y / max(radius.y, 0.0001)
    ));
    return 1.0 - smoothstep(0.45, 1.0, n);
  }

  /** 胶囊（线段）区域遮罩，用于法令纹、下颌线、颈纹等沿线分布的结构 */
  float bandMask(vec2 p, vec2 a, vec2 b, float halfWidth, float aspect) {
    vec2 pa = p - a; pa.x *= aspect;
    vec2 ba = b - a; ba.x *= aspect;
    float t = clamp(dot(pa, ba) / max(dot(ba, ba), 0.000001), 0.0, 1.0);
    float d = length(pa - ba * t);
    return 1.0 - smoothstep(halfWidth * 0.35, halfWidth, d);
  }

  /**
   * 环形均值采样：绕采样点取 8 个方向的邻域平均，作为「没有瑕疵时该处应有的肤色」。
   * 祛痘、祛斑、祛纹等都以它为修复基准。
   */
  vec3 ringAverage(sampler2D tex, vec2 uv, float radius, float aspect) {
    vec3 sum = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float ang = float(i) * 0.7853981634;
      vec2 off = vec2(cos(ang) / aspect, sin(ang)) * radius;
      sum += texture2D(tex, clamp(uv + off, 0.0, 1.0)).rgb;
    }
    return sum * 0.125;
  }

  /** 五点曲线插值（输入固定为 0/25/50/75/100%） */
  float applyCurve(float value, vec4 firstFour, float lastPoint) {
    float scaled = clamp(value, 0.0, 1.0) * 4.0;
    if (scaled < 1.0) return mix(firstFour.x, firstFour.y, scaled);
    if (scaled < 2.0) return mix(firstFour.y, firstFour.z, scaled - 1.0);
    if (scaled < 3.0) return mix(firstFour.z, firstFour.w, scaled - 2.0);
    return mix(firstFour.w, lastPoint, scaled - 3.0);
  }

  /**
   * 3D LUT 采样。立方体按「横向条带」展开为 (size*size) x size 的 2D 纹理，
   * 蓝色通道选片、红绿通道在片内定位，片间做线性插值。
   */
  vec3 sampleLut(sampler2D lut, vec3 color, float size) {
    color = clamp(color, 0.0, 1.0);
    float sliceIndex = color.b * (size - 1.0);
    float slice0 = floor(sliceIndex);
    float slice1 = min(slice0 + 1.0, size - 1.0);
    float blend = sliceIndex - slice0;
    float xInSlice = (color.r * (size - 1.0) + 0.5) / size;
    float v = (color.g * (size - 1.0) + 0.5) / size;
    vec3 c0 = texture2D(lut, vec2((slice0 + xInSlice) / size, v)).rgb;
    vec3 c1 = texture2D(lut, vec2((slice1 + xInSlice) / size, v)).rgb;
    return mix(c0, c1, blend);
  }
`;
