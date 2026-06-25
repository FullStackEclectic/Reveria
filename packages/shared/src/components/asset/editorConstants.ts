export interface RetouchSettings {
  exposure: number;     // -100 ~ 100
  contrast: number;     // -100 ~ 100
  saturation: number;   // -100 ~ 100
  blur_strength: number; // 0 ~ 100
  eye_enlarge: number;   // 0 ~ 100
  slim_face: number;     // 0 ~ 100
  lut_file: string;
}

export const DEFAULT_SETTINGS: RetouchSettings = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  blur_strength: 0,
  eye_enlarge: 0,
  slim_face: 0,
  lut_file: "",
};

// WebGL 着色器源码
export const VS_SOURCE = `
  attribute vec2 a_position;
  varying vec2 v_texCoord;
  void main() {
    v_texCoord = a_position * 0.5 + 0.5;
    v_texCoord.y = 1.0 - v_texCoord.y; // 翻转 Y 轴，对齐图片坐标
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

export const FS_SOURCE = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_image;
  
  // 滤镜参数
  uniform float u_exposure;
  uniform float u_contrast;
  uniform float u_saturation;
  uniform float u_blur;

  vec3 adjustContrast(vec3 color, float contrast) {
    return (color - 0.5) * contrast + 0.5;
  }

  vec3 adjustSaturation(vec3 color, float saturation) {
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    return mix(vec3(luma), color, saturation);
  }

  void main() {
    vec4 texColor = texture2D(u_image, v_texCoord);
    vec3 rgb = texColor.rgb;

    // 1. 曝光调节
    rgb = rgb * (1.0 + u_exposure);

    // 2. 对比度调节
    rgb = adjustContrast(rgb, 1.0 + u_contrast);

    // 3. 饱和度调节
    rgb = adjustSaturation(rgb, 1.0 + u_saturation);

    // 4. 双边滤波人像磨皮 (Bilateral Filter 模拟)
    if (u_blur > 0.0) {
      float stepX = 1.0 / 1024.0;
      float stepY = 1.0 / 1024.0;
      vec3 sum = vec3(0.0);
      float totalWeight = 0.0;

      for (int x = -2; x <= 2; x++) {
        for (int y = -2; y <= 2; y++) {
          vec2 offset = vec2(float(x) * stepX, float(y) * stepY);
          vec3 neighbor = texture2D(u_image, v_texCoord + offset).rgb;

          float colorDist = distance(rgb, neighbor);
          float weight = exp(-colorDist * colorDist * 15.0);

          sum += neighbor * weight;
          totalWeight += weight;
        }
      }
      if (totalWeight > 0.0) {
        rgb = mix(rgb, sum / totalWeight, u_blur);
      }
    }

    gl_FragColor = vec4(rgb, texColor.a);
  }
`;

// 预设效果大礼包
export const PRESET_EFFECTS = [
  { name: "无效果", settings: { exposure: 0, contrast: 0, saturation: 0, blur_strength: 0, eye_enlarge: 0, slim_face: 0, lut_file: "" } },
  { name: "透感肌", settings: { exposure: 10, contrast: 5, saturation: -5, blur_strength: 60, eye_enlarge: 15, slim_face: 10, lut_file: "gray.cube" } },
  { name: "妆容肌", settings: { exposure: 15, contrast: 10, saturation: 5, blur_strength: 70, eye_enlarge: 20, slim_face: 15, lut_file: "gray.cube" } },
  { name: "混色肌", settings: { exposure: 6, contrast: -4, saturation: 8, blur_strength: 50, eye_enlarge: 15, slim_face: 10, lut_file: "film.cube" } },
  { name: "肤色-中性", settings: { exposure: 10, contrast: 2, saturation: -8, blur_strength: 60, eye_enlarge: 12, slim_face: 10, lut_file: "" } },
  { name: "肤色-清冷", settings: { exposure: 14, contrast: 4, saturation: -12, blur_strength: 60, eye_enlarge: 12, slim_face: 10, lut_file: "gray.cube" } },
  { name: "暖秒", settings: { exposure: 16, contrast: -6, saturation: 14, blur_strength: 50, eye_enlarge: 10, slim_face: 6, lut_file: "autumn.cube" } },
  { name: "暖砂-淡色背景", settings: { exposure: 18, contrast: -8, saturation: 10, blur_strength: 55, eye_enlarge: 14, slim_face: 10, lut_file: "autumn.cube" } },
  { name: "儿童-常规洁净", settings: { exposure: 20, contrast: -10, saturation: 8, blur_strength: 50, eye_enlarge: 12, slim_face: 4, lut_file: "" } },
  { name: "孕妇-自然温和", settings: { exposure: 12, contrast: -4, saturation: 6, blur_strength: 58, eye_enlarge: 16, slim_face: 12, lut_file: "" } },
];
