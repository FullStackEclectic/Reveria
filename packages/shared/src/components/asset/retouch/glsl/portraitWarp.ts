/**
 * 人像几何形变。
 *
 * 全部采用逆映射：函数改的是「输出像素该去源图哪里取色」。
 * 因此把采样点**推离**中心，内容被压缩，该部位看起来更小/更窄；
 * 把采样点**拉向**中心，内容被放大，该部位看起来更大/更宽。
 */
export const GLSL_PORTRAIT_WARP = `
  /** 横向挤压：amount > 0 变窄，< 0 变宽 */
  vec2 warpSqueezeX(vec2 uv, vec2 center, vec2 halfSize, float amount, float aspect) {
    if (abs(amount) < 0.00001 || halfSize.x <= 0.0001 || halfSize.y <= 0.0001) return uv;
    float dy = abs(uv.y - center.y);
    float dx = uv.x - center.x;
    if (dy >= halfSize.y || abs(dx) >= halfSize.x) return uv;
    float fy = 1.0 - dy / halfSize.y; fy *= fy;
    float fx = 1.0 - abs(dx) / halfSize.x; fx *= fx;
    uv.x += sign(dx) * amount * fx * fy;
    return uv;
  }

  /** 纵向挤压：amount > 0 变短，< 0 变长 */
  vec2 warpSqueezeY(vec2 uv, vec2 center, vec2 halfSize, float amount, float aspect) {
    if (abs(amount) < 0.00001 || halfSize.x <= 0.0001 || halfSize.y <= 0.0001) return uv;
    float dx = abs(uv.x - center.x);
    float dy = uv.y - center.y;
    if (dx >= halfSize.x || abs(dy) >= halfSize.y) return uv;
    float fx = 1.0 - dx / halfSize.x; fx *= fx;
    float fy = 1.0 - abs(dy) / halfSize.y; fy *= fy;
    uv.y += sign(dy) * amount * fx * fy;
    return uv;
  }

  /** 径向缩放：amount > 0 收缩（变小），< 0 膨胀（变大） */
  vec2 warpRadial(vec2 uv, vec2 center, float radius, float amount, float aspect) {
    if (abs(amount) < 0.00001 || radius <= 0.0001) return uv;
    vec2 d = uv - center; d.x *= aspect;
    float dist = length(d);
    if (dist >= radius) return uv;
    float f = 1.0 - dist / radius; f *= f;
    return uv + (uv - center) * amount * f;
  }

  /** 定向平移：把区域内容整体朝 dir 的反方向挪动 amount */
  vec2 warpShift(vec2 uv, vec2 center, float radius, vec2 dir, float amount, float aspect) {
    if (abs(amount) < 0.00001 || radius <= 0.0001) return uv;
    vec2 d = uv - center; d.x *= aspect;
    float dist = length(d);
    if (dist >= radius) return uv;
    float f = 1.0 - dist / radius; f *= f;
    return uv + dir * amount * f;
  }

  /**
   * 汇总所有依赖人脸关键点的形变。
   * 未检出人脸时整体跳过，避免在无脸图片上产生莫名其妙的扭曲。
   */
  vec2 applyFaceWarp(vec2 uv, float aspect) {
    if (u_face_detected < 0.5) return uv;

    float span = max(EYE_SPAN, 0.02);
    float faceW = max(FACE_WIDTH, 0.05);
    float faceH = max(FACE_HEIGHT, 0.05);
    float mouthW = max(MOUTH_WIDTH, 0.02);

    // 大眼：把采样点拉向眼心，眼部内容被放大
    float enlarge = P_EYE_ENLARGE * 0.0022;
    uv = warpRadial(uv, FP_EYE_LEFT,  span * 0.40, -enlarge, aspect);
    uv = warpRadial(uv, FP_EYE_RIGHT, span * 0.40, -enlarge, aspect);

    // 卧蚕：下眼睑轻微膨胀（正值）或压平（负值）
    float tear = P_TEAR_TROUGH * 0.0009;
    uv = warpRadial(uv, FP_UNDER_EYE_LEFT,  span * 0.26, -tear, aspect);
    uv = warpRadial(uv, FP_UNDER_EYE_RIGHT, span * 0.26, -tear, aspect);

    // 瘦脸：以脸颊高度为中心横向收窄
    float cheekY = (FP_CHEEK_LEFT.y + FP_CHEEK_RIGHT.y) * 0.5;
    uv = warpSqueezeX(uv, vec2(FP_FACE_CENTER.x, cheekY),
                      vec2(faceW * 0.60, faceH * 0.42), P_SLIM_FACE * 0.00020, aspect);

    // 捏骨头型：作用范围覆盖整张脸，正值收窄轮廓
    uv = warpSqueezeX(uv, vec2(FP_FACE_CENTER.x, FP_FACE_CENTER.y),
                      vec2(faceW * 0.65, faceH * 0.55), P_BONE_SHAPE * 0.00016, aspect);

    // 额头宽度
    uv = warpSqueezeX(uv, vec2(FP_FACE_CENTER.x, FP_FOREHEAD.y),
                      vec2(faceW * 0.52, faceH * 0.22), P_FOREHEAD_WIDTH * 0.00016, aspect);

    // 颧骨收放
    float cheekboneY = (FP_CHEEKBONE_LEFT.y + FP_CHEEKBONE_RIGHT.y) * 0.5;
    uv = warpSqueezeX(uv, vec2(FP_FACE_CENTER.x, cheekboneY),
                      vec2(faceW * 0.58, faceH * 0.20), P_CHEEKBONE * 0.00018, aspect);

    // 中庭：眉心到鼻尖之间纵向收放
    vec2 midCenter = (FP_GLABELLA + FP_NOSE_TIP) * 0.5;
    uv = warpSqueezeY(uv, midCenter,
                      vec2(faceW * 0.34, abs(FP_NOSE_TIP.y - FP_GLABELLA.y) * 0.85 + 0.01),
                      P_MID_BONE * 0.00014, aspect);

    // 下巴宽度与下巴纹
    uv = warpSqueezeX(uv, FP_CHIN, vec2(faceW * 0.26, faceH * 0.16), P_CHIN_WIDTH * 0.00016, aspect);
    uv = warpSqueezeX(uv, FP_CHIN_CREASE, vec2(faceW * 0.16, faceH * 0.10), P_CHIN_CREASE * 0.00012, aspect);

    // 鼻宽与鼻长
    vec2 noseCenter = (FP_NOSE_ALA_LEFT + FP_NOSE_ALA_RIGHT) * 0.5;
    float noseHalfW = max(abs(FP_NOSE_ALA_RIGHT.x - FP_NOSE_ALA_LEFT.x) * 0.9, 0.02);
    uv = warpSqueezeX(uv, noseCenter, vec2(noseHalfW, span * 0.34), P_NOSE_WIDTH * 0.00014, aspect);
    uv = warpSqueezeY(uv, (FP_NOSE_BRIDGE + FP_NOSE_TIP) * 0.5,
                      vec2(noseHalfW * 1.2, abs(FP_NOSE_TIP.y - FP_NOSE_BRIDGE.y) * 0.9 + 0.01),
                      P_NOSE_LENGTH * 0.00014, aspect);

    // 嘴宽：正值收窄
    uv = warpSqueezeX(uv, FP_MOUTH_CENTER, vec2(mouthW * 0.85, mouthW * 0.42),
                      P_MOUTH_WIDTH * 0.00016, aspect);

    // 祛双下巴：下颌与颈部之间纵向上提，收紧轮廓
    vec2 chinLower = (FP_CHIN + FP_NECK) * 0.5;
    uv = warpShift(uv, chinLower, faceW * 0.42, vec2(0.0, 1.0),
                   P_DOUBLE_CHIN_REMOVAL * 0.00018, aspect);

    // 发量：额头上方区域膨胀，营造蓬松感
    vec2 hairCenter = FP_FOREHEAD + vec2(0.0, -(faceH * 0.34));
    uv = warpRadial(uv, hairCenter, faceW * 0.62, -P_HAIR_VOLUME * 0.00080, aspect);

    return uv;
  }
`;
