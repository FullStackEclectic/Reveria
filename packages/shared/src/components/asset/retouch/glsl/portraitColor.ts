/**
 * 人像色彩域算法。
 *
 * 共同的思路是「频率分离 + 区域选区」：
 * 用环形均值得到该处**没有瑕疵时应有的肤色**作为修复基准，再按各效果的判据
 * （偏红=痘、偏暗=斑/纹、高亮低饱和=油光）决定融合强度，最后按需回补高频纹理。
 * 所有效果都乘以肤色遮罩与区域遮罩，避免污染背景与五官边缘。
 */
export const GLSL_PORTRAIT_COLOR = `
  /** 胡须区域：下半脸中偏暗的部分 */
  float beardRegionMask(vec3 rgb, vec2 uv, float aspect) {
    if (u_face_detected < 0.5) return 0.0;
    vec2 center = mix(FP_MOUTH_CENTER, FP_CHIN, 0.35);
    float region = ellipseMask(uv, center, vec2(MOUTH_WIDTH * 1.10, MOUTH_WIDTH * 0.80), aspect);
    float dark = 1.0 - smoothstep(0.16, 0.44, luma(rgb));
    return clamp(region * dark, 0.0, 1.0);
  }

  /** 修复类效果的保护系数：开启保护开关后避开彩妆与成形的胡须 */
  float protectionFactor(vec3 rgb, float beard) {
    float p = 1.0;
    if (P_PROTECT_MAKEUP > 0.5) p *= 1.0 - smoothstep(0.13, 0.32, chroma(rgb));
    if (P_PROTECT_BEARD > 0.5) p *= 1.0 - beard;
    return clamp(p, 0.0, 1.0);
  }

  /**
   * 皱纹填补：只把「比周围暗的沟壑」抬回周围肤色，
   * 不动比周围亮的高光，因此不会把五官结构一起抹平。
   */
  vec3 fillWrinkle(vec3 c, vec3 base, float mask, float strength, float protect) {
    if (mask * strength < 0.01) return c;
    float deficit = luma(base) - luma(c);
    float amount = smoothstep(0.005, 0.055, deficit) * mask * protect;
    return mix(c, base, amount * strength * 0.01);
  }

  /** 瑕疵抑制：按亮度亏损判定，用于祛斑、祛痣、身体祛瑕疵 */
  vec3 suppressDarkBlemish(vec3 c, vec3 base, float mask, float strength, float lo, float hi) {
    if (mask * strength < 0.01) return c;
    float deficit = luma(base) - luma(c);
    float amount = smoothstep(lo, hi, deficit) * mask;
    return mix(c, base, amount * strength * 0.01);
  }

  /** 双边滤波：保边平滑，磨皮与中性灰共用 */
  vec3 bilateralSmooth(vec2 uv, vec3 center, float sx, float sy, float spread) {
    vec3 sum = vec3(0.0);
    float total = 0.0;
    for (int x = -2; x <= 2; x++) {
      for (int y = -2; y <= 2; y++) {
        vec2 off = vec2(float(x) * sx, float(y) * sy) * spread;
        vec3 nb = texture2D(u_image, clamp(uv + off, 0.0, 1.0)).rgb;
        float cd = distance(center, nb);
        float w = exp(-cd * cd * 15.0);
        sum += nb * w;
        total += w;
      }
    }
    return total > 0.0 ? sum / total : center;
  }

  /**
   * 人像色彩管线主入口。
   * uv 为已完成几何形变的源图坐标，rgb 为该处已完成局部修复（污点/仿制）的颜色。
   */
  vec3 applyPortraitColor(vec3 rgb, vec2 uv, float aspect, float sx, float sy) {
    vec3 original = rgb;
    bool hasFace = u_face_detected > 0.5;
    float skin = skinMask(rgb);
    float beard = beardRegionMask(rgb, uv, aspect);
    float protect = protectionFactor(rgb, beard);

    // 局部特征的基准尺度：有脸时随瞳距缩放，无脸时退回固定比例
    float unit = hasFace ? max(EYE_SPAN, 0.02) : 0.06;
    float faceW = hasFace ? max(FACE_WIDTH, 0.05) : 0.3;
    float faceH = hasFace ? max(FACE_HEIGHT, 0.05) : 0.4;
    float mouthW = hasFace ? max(MOUTH_WIDTH, 0.02) : 0.1;
    float rSmall = unit * 0.055;
    float rMid   = unit * 0.130;
    float rWide  = unit * 0.300;

    // ---- 三档环形基准，按需采样，未启用相关效果时零开销 ----
    float needSmall = max(P_MOLE_REMOVAL, max(P_TEXTURE_RETAIN, max(P_SKIN_FLATNESS, abs(P_SKIN_TEXTURE))));
    float needMid = max(max(P_ACNE_REMOVAL, P_SPOT_REMOVAL), max(P_BEARD_REMOVAL, P_BODY_BLEMISH_REMOVAL));
    needMid = max(needMid, max(max(P_FOREHEAD_WRINKLE, P_FROWN_WRINKLE), max(P_EYE_WRINKLE, P_NOSE_WRINKLE)));
    needMid = max(needMid, max(max(P_NASOLABIAL_LEFT, P_NASOLABIAL_RIGHT), max(P_CHEEK_WRINKLE, P_MARIONETTE_WRINKLE)));
    needMid = max(needMid, max(max(P_MOUTH_WRINKLE, P_LIP_WRINKLE_REMOVAL), max(P_NECK_WRINKLE_REMOVAL, P_FACIAL_NOISE)));
    float needWide = max(max(P_SHINE_REMOVAL, P_EYE_BAG_REMOVAL), max(P_DARK_NOSE, P_BLUSH_FLAT));
    needWide = max(needWide, max(P_JAWLINE_ENHANCE, P_SKIN_FLATNESS));

    vec3 baseSmall = rgb;
    vec3 baseMid = rgb;
    vec3 baseWide = rgb;
    if (needSmall > 0.01) baseSmall = ringAverage(u_image, uv, rSmall, aspect);
    if (needMid   > 0.01) baseMid   = ringAverage(u_image, uv, rMid, aspect);
    if (needWide  > 0.01) baseWide  = ringAverage(u_image, uv, rWide, aspect);

    // ---- 祛瑕疵 ----
    // 瑕疵本身往往已经偏离肤色范围（痘偏红、痣偏暗），若按像素自身判定肤色，
    // 恰好会把该修的像素排除在外。因此改用「周围一圈是不是皮肤」来判定。
    float skinNear = max(skin, skinMask(baseMid));
    float skinTight = max(skin, skinMask(baseSmall));
    // 痣：极小且极暗
    rgb = suppressDarkBlemish(rgb, baseSmall, skinTight * protect, P_MOLE_REMOVAL, 0.040, 0.160);
    // 斑：中等尺度的暗块
    rgb = suppressDarkBlemish(rgb, baseMid, skinNear * protect, P_SPOT_REMOVAL, 0.012, 0.090);
    // 痘：以「比周围更红」为判据，避免把阴影当成痘
    if (P_ACNE_REMOVAL > 0.01) {
      float redHere = rgb.r - (rgb.g + rgb.b) * 0.5;
      float redBase = baseMid.r - (baseMid.g + baseMid.b) * 0.5;
      float amount = smoothstep(0.008, 0.060, redHere - redBase) * skinNear * protect;
      rgb = mix(rgb, baseMid, amount * P_ACNE_REMOVAL * 0.01);
    }
    // 身体祛瑕疵：作用于人脸之外的肤色区域
    if (P_BODY_BLEMISH_REMOVAL > 0.01) {
      float outsideFace = 1.0;
      if (hasFace) {
        outsideFace = 1.0 - ellipseMask(uv, FP_FACE_CENTER, vec2(faceW * 0.62, faceH * 0.62), aspect);
      }
      rgb = suppressDarkBlemish(rgb, baseMid, skinNear * outsideFace, P_BODY_BLEMISH_REMOVAL, 0.010, 0.080);
    }
    // 祛胡须：仅在胡须区域抑制暗色胡茬，不受胡型保护影响
    if (P_BEARD_REMOVAL > 0.01 && hasFace) {
      rgb = suppressDarkBlemish(rgb, baseMid, beard, P_BEARD_REMOVAL, 0.006, 0.080);
    }

    // ---- 面部祛纹：各区域共用 fillWrinkle，仅遮罩不同 ----
    if (hasFace) {
      rgb = fillWrinkle(rgb, baseMid,
        ellipseMask(uv, FP_FOREHEAD, vec2(faceW * 0.36, faceH * 0.14), aspect),
        P_FOREHEAD_WRINKLE, protect);
      rgb = fillWrinkle(rgb, baseMid,
        ellipseMask(uv, FP_GLABELLA, vec2(unit * 0.30, unit * 0.34), aspect),
        P_FROWN_WRINKLE, protect);
      rgb = fillWrinkle(rgb, baseMid,
        max(ellipseMask(uv, FP_EYE_OUTER_LEFT,  vec2(unit * 0.28, unit * 0.24), aspect),
            ellipseMask(uv, FP_EYE_OUTER_RIGHT, vec2(unit * 0.28, unit * 0.24), aspect)),
        P_EYE_WRINKLE, protect);
      rgb = fillWrinkle(rgb, baseMid,
        ellipseMask(uv, FP_NOSE_BRIDGE, vec2(unit * 0.26, unit * 0.22), aspect),
        P_NOSE_WRINKLE, protect);
      // 法令纹：鼻翼到嘴角的带状区域，左右可独立调节
      rgb = fillWrinkle(rgb, baseMid,
        bandMask(uv, FP_NOSE_ALA_LEFT, FP_MOUTH_LEFT, unit * 0.20, aspect),
        P_NASOLABIAL_LEFT, protect);
      rgb = fillWrinkle(rgb, baseMid,
        bandMask(uv, FP_NOSE_ALA_RIGHT, FP_MOUTH_RIGHT, unit * 0.20, aspect),
        P_NASOLABIAL_RIGHT, protect);
      rgb = fillWrinkle(rgb, baseMid,
        max(ellipseMask(uv, FP_CHEEK_LEFT,  vec2(unit * 0.44, unit * 0.38), aspect),
            ellipseMask(uv, FP_CHEEK_RIGHT, vec2(unit * 0.44, unit * 0.38), aspect)),
        P_CHEEK_WRINKLE, protect);
      // 木偶纹：嘴角向下颌延伸的两条纹路
      rgb = fillWrinkle(rgb, baseMid,
        max(bandMask(uv, FP_MOUTH_LEFT,  FP_MARIONETTE_LEFT,  unit * 0.17, aspect),
            bandMask(uv, FP_MOUTH_RIGHT, FP_MARIONETTE_RIGHT, unit * 0.17, aspect)),
        P_MARIONETTE_WRINKLE, protect);
      // 嘴周纹：环唇一圈，排除唇面本身
      float mouthRing = ellipseMask(uv, FP_MOUTH_CENTER, vec2(mouthW * 0.95, mouthW * 0.62), aspect)
        * (1.0 - ellipseMask(uv, FP_MOUTH_CENTER, vec2(mouthW * 0.56, mouthW * 0.28), aspect));
      rgb = fillWrinkle(rgb, baseMid, mouthRing, P_MOUTH_WRINKLE, protect);
      // 唇纹：只作用于唇面
      float lipMask = ellipseMask(uv, mix(FP_UPPER_LIP, FP_LOWER_LIP, 0.5),
                                  vec2(mouthW * 0.54, mouthW * 0.26), aspect);
      rgb = fillWrinkle(rgb, baseMid, lipMask, P_LIP_WRINKLE_REMOVAL, 1.0);
      // 颈纹：颈部横向带状
      float neckMask = ellipseMask(uv, FP_NECK, vec2(faceW * 0.46, faceH * 0.16), aspect);
      rgb = fillWrinkle(rgb, baseMid, neckMask * skin, P_NECK_WRINKLE_REMOVAL, 1.0);
    }

    // ---- 祛油光：高亮低饱和的皮肤压回周围肤色 ----
    if (P_SHINE_REMOVAL > 0.01) {
      float shine = skin
        * smoothstep(0.60, 0.90, luma(rgb))
        * (1.0 - smoothstep(0.04, 0.17, chroma(rgb)));
      rgb = mix(rgb, baseWide, shine * protect * P_SHINE_REMOVAL * 0.01);
    }

    // ---- 眼周：黑眼圈以脸颊肤色为参考做色彩迁移，眼袋填平阴影 ----
    if (hasFace) {
      if (P_DARK_CIRCLE_REMOVAL > 0.01) {
        float m = max(
          ellipseMask(uv, FP_UNDER_EYE_LEFT,  vec2(unit * 0.34, unit * 0.20), aspect),
          ellipseMask(uv, FP_UNDER_EYE_RIGHT, vec2(unit * 0.34, unit * 0.20), aspect)
        );
        vec3 healthy = (texture2D(u_image, FP_CHEEK_LEFT).rgb
                      + texture2D(u_image, FP_CHEEK_RIGHT).rgb) * 0.5;
        float darkness = smoothstep(0.0, 0.16, luma(healthy) - luma(rgb));
        rgb = mix(rgb, healthy, m * darkness * P_DARK_CIRCLE_REMOVAL * 0.008);
      }
      if (P_EYE_BAG_REMOVAL > 0.01) {
        float m = max(
          ellipseMask(uv, FP_UNDER_EYE_LEFT,  vec2(unit * 0.36, unit * 0.26), aspect),
          ellipseMask(uv, FP_UNDER_EYE_RIGHT, vec2(unit * 0.36, unit * 0.26), aspect)
        );
        rgb = suppressDarkBlemish(rgb, baseWide, m, P_EYE_BAG_REMOVAL, 0.004, 0.060);
      }
      // 鼻孔瑕疵：提亮孔内死黑，保留孔洞轮廓
      if (P_NOSTRIL_FLAW_REMOVAL > 0.01) {
        float m = max(
          ellipseMask(uv, FP_NOSTRIL_LEFT,  vec2(unit * 0.15, unit * 0.11), aspect),
          ellipseMask(uv, FP_NOSTRIL_RIGHT, vec2(unit * 0.15, unit * 0.11), aspect)
        );
        float dark = 1.0 - smoothstep(0.04, 0.34, luma(rgb));
        rgb += vec3(P_NOSTRIL_FLAW_REMOVAL * 0.0016) * m * dark;
      }
      if (P_DARK_NOSE > 0.01) {
        float m = ellipseMask(uv, FP_NOSE_TIP, vec2(unit * 0.32, unit * 0.28), aspect);
        rgb = suppressDarkBlemish(rgb, baseWide, m, P_DARK_NOSE, 0.0, 0.140);
      }
      // 泛黄额头：只中和黄色偏，不改亮度
      if (P_YELLOW_FOREHEAD > 0.01) {
        float m = ellipseMask(uv, FP_FOREHEAD, vec2(faceW * 0.34, faceH * 0.16), aspect);
        float yellow = smoothstep(0.02, 0.16, (rgb.r + rgb.g) * 0.5 - rgb.b);
        float k = m * yellow * P_YELLOW_FOREHEAD * 0.01;
        rgb.b += k * 0.10;
        rgb.r -= k * 0.03;
      }
    }

    // ---- 磨皮与皮肤质感 ----
    // 极细磨皮：双边滤波，仅作用于皮肤，避免把背景一起糊掉
    if (P_BLUR_STRENGTH > 0.01) {
      vec3 smoothed = bilateralSmooth(uv, rgb, sx, sy, 1.0);
      rgb = mix(rgb, smoothed, skin * protect * P_BLUR_STRENGTH * 0.01);
    }
    // 中性灰磨皮：只修明暗不动色彩，最大限度保留皮肤纹理
    if (P_NEUTRAL_GRAY_SMOOTH > 0.01) {
      vec3 smoothed = bilateralSmooth(uv, rgb, sx, sy, 2.0);
      float delta = luma(smoothed) - luma(rgb);
      rgb += vec3(delta * skin * protect * P_NEUTRAL_GRAY_SMOOTH * 0.01);
    }
    // 皮肤平整度：频率分离，压低中频起伏后把高频细节接回来
    if (P_SKIN_FLATNESS > 0.01) {
      vec3 detail = rgb - baseSmall;
      rgb = mix(rgb, baseWide + detail, skin * P_SKIN_FLATNESS * 0.01);
    }
    // 去面部杂色：只平滑色度分量，保留亮度细节
    if (P_FACIAL_NOISE > 0.01) {
      float l = luma(rgb);
      vec3 targetChroma = baseMid - vec3(luma(baseMid));
      rgb = vec3(l) + mix(rgb - vec3(l), targetChroma, skin * P_FACIAL_NOISE * 0.01);
    }
    // 皮肤纹理：正值增强毛孔细节，负值进一步柔化
    if (abs(P_SKIN_TEXTURE) > 0.01) {
      rgb += (rgb - baseSmall) * P_SKIN_TEXTURE * 0.012 * skin;
    }
    // 质感保留：把原图高频按比例补回，抵消过度磨皮的塑料感
    if (P_TEXTURE_RETAIN > 0.01) {
      vec3 detail = original - baseSmall;
      rgb += detail * P_TEXTURE_RETAIN * 0.01 * skin;
    }

    // ---- 肤色与光感 ----
    if (P_SKIN_WHITEN > 0.01) {
      rgb += vec3(P_SKIN_WHITEN * 0.0015) * skin;
    }
    if (P_SKIN_TONE > 0.01 && hasFace) {
      vec3 reference = (texture2D(u_image, FP_CHEEK_LEFT).rgb
                      + texture2D(u_image, FP_CHEEK_RIGHT).rgb) * 0.5;
      float l = luma(rgb);
      vec3 referenceChroma = reference - vec3(luma(reference));
      rgb = vec3(l) + mix(rgb - vec3(l), referenceChroma, skin * P_SKIN_TONE * 0.006);
    }
    if (abs(P_SKIN_HIGHLIGHT) > 0.01) {
      float hi = smoothstep(0.55, 0.92, luma(rgb));
      rgb += vec3(P_SKIN_HIGHLIGHT * 0.0016) * hi * skin;
    }

    // ---- 五官局部润饰 ----
    if (hasFace) {
      // 牙齿美白：口腔内偏亮且偏黄的区域去黄提亮，唇色不受影响
      if (P_TEETH_WHITEN > 0.01) {
        float m = ellipseMask(uv, FP_MOUTH_INNER, vec2(mouthW * 0.40, mouthW * 0.15), aspect);
        float bright = smoothstep(0.20, 0.48, luma(rgb));
        float yellowish = smoothstep(0.010, 0.100, rgb.r - rgb.b);
        float k = m * bright * yellowish * P_TEETH_WHITEN * 0.01;
        rgb.b += k * 0.13;
        rgb.g += k * 0.04;
        rgb += vec3(k * 0.05);
      }
      // 腮红平整：统一脸颊的色度分布，不改亮度
      if (P_BLUSH_FLAT > 0.01) {
        float m = max(ellipseMask(uv, FP_CHEEK_LEFT,  vec2(unit * 0.46, unit * 0.36), aspect),
                      ellipseMask(uv, FP_CHEEK_RIGHT, vec2(unit * 0.46, unit * 0.36), aspect));
        float l = luma(rgb);
        vec3 baseChroma = baseWide - vec3(luma(baseWide));
        rgb = vec3(l) + mix(rgb - vec3(l), baseChroma, m * P_BLUSH_FLAT * 0.01);
      }
      // 下颌线增强：沿下颌带状区域强化局部对比，让轮廓更清晰
      if (P_JAWLINE_ENHANCE > 0.01) {
        float band = max(bandMask(uv, FP_JAW_LEFT,  FP_CHIN, unit * 0.20, aspect),
                         bandMask(uv, FP_JAW_RIGHT, FP_CHIN, unit * 0.20, aspect));
        float localContrast = luma(rgb) - luma(baseWide);
        rgb += vec3(localContrast * band * P_JAWLINE_ENHANCE * 0.020);
      }
      // 双下巴阴影：淡化下颌到颈部之间的投影
      if (P_DOUBLE_CHIN_SHADOW > 0.01) {
        float m = ellipseMask(uv, mix(FP_CHIN, FP_NECK, 0.5),
                              vec2(faceW * 0.36, faceH * 0.16), aspect);
        float shadow = 1.0 - smoothstep(0.04, 0.45, luma(rgb));
        rgb += vec3(m * shadow * P_DOUBLE_CHIN_SHADOW * 0.0016);
      }
      // 亮眼：只提亮眼裂内明亮、低饱和的眼白，避免漂白虹膜与眼周皮肤
      if (P_EYE_BRIGHTEN > 0.01) {
        float eyeMask = max(
          ellipseMask(uv, FP_EYE_LEFT,  vec2(u_eye_left_radius_x,  u_eye_left_radius_y),  aspect),
          ellipseMask(uv, FP_EYE_RIGHT, vec2(u_eye_right_radius_x, u_eye_right_radius_y), aspect)
        );
        float eyeLuma = luma(rgb);
        float whiteMask = eyeMask
          * smoothstep(0.32, 0.62, eyeLuma)
          * (1.0 - smoothstep(0.08, 0.28, chroma(rgb)));
        float strength = P_EYE_BRIGHTEN * 0.0035 * whiteMask;
        rgb += vec3(strength);
        rgb = mix(rgb, vec3(luma(rgb)), min(0.18, strength * 0.35));
      }
    }

    return rgb;
  }
`;
