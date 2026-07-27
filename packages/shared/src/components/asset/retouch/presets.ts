import { DEFAULT_SETTINGS } from "./settings";

export const PRESET_EFFECTS = [
  { name: "无效果",    settings: { ...DEFAULT_SETTINGS } },
  { name: "透感肌",   settings: { ...DEFAULT_SETTINGS, exposure: 10, contrast: 5,  saturation: -5,  blur_strength: 60, eye_enlarge: 15, slim_face: 10, temperature: -5,  skin_whiten: 20, texture_retain: 30 } },
  { name: "妆容肌",   settings: { ...DEFAULT_SETTINGS, exposure: 15, contrast: 10, saturation: 5,   blur_strength: 70, eye_enlarge: 20, slim_face: 15, highlights: 10,   skin_whiten: 15, protect_makeup: 1, texture_retain: 25 } },
  { name: "混色肌",   settings: { ...DEFAULT_SETTINGS, exposure: 6,  contrast: -4, saturation: 8,   blur_strength: 50, eye_enlarge: 15, slim_face: 10, vibrance: 15, texture_retain: 35 } },
  { name: "肤色-中性",settings: { ...DEFAULT_SETTINGS, exposure: 10, contrast: 2,  saturation: -8,  blur_strength: 60, eye_enlarge: 12, slim_face: 10, skin_whiten: 10, skin_tone: 40 } },
  { name: "肤色-清冷",settings: { ...DEFAULT_SETTINGS, exposure: 14, contrast: 4,  saturation: -12, blur_strength: 60, eye_enlarge: 12, slim_face: 10, temperature: -15, skin_tone: 35 } },
  { name: "暖秒",     settings: { ...DEFAULT_SETTINGS, exposure: 16, contrast: -6, saturation: 14,  blur_strength: 50, eye_enlarge: 10, slim_face: 6,  temperature: 20 } },
  { name: "暖砂",     settings: { ...DEFAULT_SETTINGS, exposure: 18, contrast: -8, saturation: 10,  blur_strength: 55, eye_enlarge: 14, slim_face: 10, temperature: 15,  shadows: 10 } },
  { name: "儿童-清新",settings: { ...DEFAULT_SETTINGS, exposure: 20, contrast: -10,saturation: 8,   blur_strength: 50, eye_enlarge: 12, slim_face: 4,  vibrance: 10,     clarity: 5, texture_retain: 40 } },
  { name: "孕妇-温和",settings: { ...DEFAULT_SETTINGS, exposure: 12, contrast: -4, saturation: 6,   blur_strength: 58, eye_enlarge: 16, slim_face: 12, skin_whiten: 15,  temperature: 5 } },
  { name: "证件照-通用", settings: { ...DEFAULT_SETTINGS, exposure: 8, contrast: 6, blur_strength: 45, skin_whiten: 12, spot_removal: 45, acne_removal: 45, shine_removal: 40, dark_circle_removal: 35, texture_retain: 30, sharpness: 15 } },
  { name: "商务人像", settings: { ...DEFAULT_SETTINGS, exposure: 6, contrast: 10, clarity: 8, blur_strength: 35, neutral_gray_smooth: 40, shine_removal: 50, jawline_enhance: 30, texture_retain: 45, sharpness: 20 } },
  { name: "长辈-柔化", settings: { ...DEFAULT_SETTINGS, exposure: 12, contrast: -4, blur_strength: 40, forehead_wrinkle: 55, frown_wrinkle: 45, eye_wrinkle: 50, nasolabial_left: 55, nasolabial_right: 55, marionette_wrinkle: 45, neck_wrinkle_removal: 40, texture_retain: 35 } },
];
