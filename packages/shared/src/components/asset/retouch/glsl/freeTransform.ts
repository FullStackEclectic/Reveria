/**
 * 8 点自由变形：把输出 UV 逆映射回源图。
 * 四个角与四条边中点把画面分成 2×2 格子，每格做双线性求逆（含平行四边形退化）。
 */
export const GLSL_FREE_TRANSFORM = `
  float ftCross(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }

  vec2 invBilinear(vec2 p, vec2 a, vec2 b, vec2 c, vec2 d) {
    vec2 e = b - a;
    vec2 f = d - a;
    vec2 g = a - b + c - d;
    vec2 h = p - a;
    float k2 = ftCross(g, f);
    float k1 = ftCross(e, f) + ftCross(h, g);
    float k0 = ftCross(h, e);
    float u = -1.0;
    float v = -1.0;

    if (abs(k2) < 0.0001) {
      if (abs(k1) < 0.0001) return vec2(-1.0);
      v = -k0 / k1;
      vec2 denom = e + g * v;
      if (abs(denom.x) > abs(denom.y)) {
        if (abs(denom.x) < 0.0001) return vec2(-1.0);
        u = (h.x - f.x * v) / denom.x;
      } else {
        if (abs(denom.y) < 0.0001) return vec2(-1.0);
        u = (h.y - f.y * v) / denom.y;
      }
    } else {
      float disc = k1 * k1 - 4.0 * k2 * k0;
      if (disc < 0.0) return vec2(-1.0);
      float root = sqrt(disc);
      float v1 = (-k1 - root) / (2.0 * k2);
      float v2 = (-k1 + root) / (2.0 * k2);
      vec2 den1 = e + g * v1;
      vec2 den2 = e + g * v2;
      float u1 = abs(den1.x) > abs(den1.y)
        ? (abs(den1.x) < 0.0001 ? -1.0 : (h.x - f.x * v1) / den1.x)
        : (abs(den1.y) < 0.0001 ? -1.0 : (h.y - f.y * v1) / den1.y);
      float u2 = abs(den2.x) > abs(den2.y)
        ? (abs(den2.x) < 0.0001 ? -1.0 : (h.x - f.x * v2) / den2.x)
        : (abs(den2.y) < 0.0001 ? -1.0 : (h.y - f.y * v2) / den2.y);
      bool ok1 = u1 >= -0.002 && u1 <= 1.002 && v1 >= -0.002 && v1 <= 1.002;
      bool ok2 = u2 >= -0.002 && u2 <= 1.002 && v2 >= -0.002 && v2 <= 1.002;
      if (ok1) { u = u1; v = v1; }
      else if (ok2) { u = u2; v = v2; }
      else return vec2(-1.0);
    }

    if (u < -0.002 || u > 1.002 || v < -0.002 || v > 1.002) return vec2(-1.0);
    return vec2(clamp(u, 0.0, 1.0), clamp(v, 0.0, 1.0));
  }

  vec2 applyFreeTransform(vec2 p) {
    if (u_free_transform_enabled < 0.5) return p;
    vec2 center = (u_ft_mt + u_ft_mr + u_ft_mb + u_ft_ml) * 0.25;
    vec2 local = invBilinear(p, u_ft_tl, u_ft_mt, center, u_ft_ml);
    if (local.x >= 0.0) return local * 0.5;
    local = invBilinear(p, u_ft_mt, u_ft_tr, u_ft_mr, center);
    if (local.x >= 0.0) return vec2(0.5 + local.x * 0.5, local.y * 0.5);
    local = invBilinear(p, u_ft_ml, center, u_ft_mb, u_ft_bl);
    if (local.x >= 0.0) return vec2(local.x * 0.5, 0.5 + local.y * 0.5);
    local = invBilinear(p, center, u_ft_mr, u_ft_br, u_ft_mb);
    if (local.x >= 0.0) return vec2(0.5 + local.x * 0.5, 0.5 + local.y * 0.5);
    return vec2(-1.0);
  }
`;
