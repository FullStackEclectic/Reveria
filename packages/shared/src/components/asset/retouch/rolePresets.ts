import type { PortraitSettings } from "./portraitParams";

export type PortraitRole = "female" | "male" | "child" | "elder_female" | "elder_male";

export interface RolePresetMeta {
  id: PortraitRole;
  label: string;
  description: string;
  /** 该角色的人像基线参数，点击角色时并入当前设置 */
  baseline: Partial<PortraitSettings>;
}

/**
 * 角色基线：不同人群的修图侧重差别很大，
 * 选择角色即套用一组起始参数，之后仍可逐项微调。
 */
export const ROLE_PRESETS: RolePresetMeta[] = [
  {
    id: "female",
    label: "女",
    description: "均衡磨皮与瑕疵处理，保留适度皮肤质感",
    baseline: {
      blur_strength: 55, texture_retain: 30, skin_whiten: 15,
      acne_removal: 45, spot_removal: 40, shine_removal: 35,
      dark_circle_removal: 30, eye_brighten: 20, eye_enlarge: 12, slim_face: 10,
      protect_makeup: 1,
    },
  },
  {
    id: "male",
    label: "男",
    description: "弱磨皮、重质感，默认开启胡型保护",
    baseline: {
      blur_strength: 28, neutral_gray_smooth: 35, texture_retain: 55,
      acne_removal: 40, spot_removal: 30, shine_removal: 50,
      jawline_enhance: 25, eye_enlarge: 0, slim_face: 4,
      protect_beard: 1,
    },
  },
  {
    id: "child",
    label: "儿童",
    description: "仅做轻度净肤，不做纹路与轮廓处理",
    baseline: {
      blur_strength: 30, texture_retain: 45, skin_whiten: 8,
      acne_removal: 25, spot_removal: 20, facial_noise: 20,
      eye_brighten: 15, eye_enlarge: 8, slim_face: 0,
    },
  },
  {
    id: "elder_female",
    label: "长辈女",
    description: "以淡化纹路为主，保留自然的皮肤起伏",
    baseline: {
      blur_strength: 38, neutral_gray_smooth: 30, texture_retain: 40,
      forehead_wrinkle: 50, frown_wrinkle: 45, eye_wrinkle: 50,
      nasolabial_left: 50, nasolabial_right: 50, marionette_wrinkle: 40,
      cheek_wrinkle: 35, neck_wrinkle_removal: 40,
      spot_removal: 45, dark_circle_removal: 30, skin_whiten: 12,
    },
  },
  {
    id: "elder_male",
    label: "长辈男",
    description: "淡化纹路同时保留胡型与皮肤纹理",
    baseline: {
      blur_strength: 26, neutral_gray_smooth: 32, texture_retain: 55,
      forehead_wrinkle: 45, frown_wrinkle: 40, eye_wrinkle: 45,
      nasolabial_left: 45, nasolabial_right: 45, marionette_wrinkle: 35,
      neck_wrinkle_removal: 35, spot_removal: 40, shine_removal: 40,
      protect_beard: 1,
    },
  },
];

export const ROLE_PRESET_MAP: Record<PortraitRole, RolePresetMeta> = Object.fromEntries(
  ROLE_PRESETS.map((preset) => [preset.id, preset]),
) as Record<PortraitRole, RolePresetMeta>;
